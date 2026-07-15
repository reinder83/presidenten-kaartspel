import { useEffect, useMemo, useRef, useState } from 'react';
import { socket } from './socket';
import {
  Card as CardT,
  GameView,
  ROLE_LABELS,
  RoomView,
  SUIT_SYMBOLS,
  rankLabel,
} from './types';

export default function App() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const roomRef = useRef<RoomView | null>(null);
  roomRef.current = room;

  useEffect(() => {
    const onRoom = (r: RoomView) => setRoom(r);
    const onError = (msg: string) => {
      setError(msg);
      setTimeout(() => setError(null), 4000);
    };
    const onNotice = (msg: string) => {
      setNotice(msg);
      setTimeout(() => setNotice(null), 5000);
    };
    const onConnect = () => {
      setConnected(true);
      // After a reconnect the server sees a brand-new connection: reclaim our seat.
      const r = roomRef.current;
      if (r) {
        socket.emit('joinRoom', {
          code: r.code,
          name: localStorage.getItem('presidenten-name') ?? 'Speler',
        });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onRoomGone = () => {
      setRoom(null);
      setError('De kamer bestaat niet meer.');
      setTimeout(() => setError(null), 4000);
    };
    socket.on('room', onRoom);
    socket.on('errorMsg', onError);
    socket.on('notice', onNotice);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('roomGone', onRoomGone);
    return () => {
      socket.off('room', onRoom);
      socket.off('errorMsg', onError);
      socket.off('notice', onNotice);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('roomGone', onRoomGone);
    };
  }, []);

  const leaveRoom = () => {
    socket.emit('leaveRoom');
    setRoom(null);
  };

  return (
    <div className="app">
      {error && <div className="toast">{error}</div>}
      {notice && <div className="toast info">{notice}</div>}
      {!connected && <div className="toast">Verbinding met de server verbroken…</div>}
      {!room ? (
        <Lobby />
      ) : room.game ? (
        <Game room={room} onLeave={leaveRoom} />
      ) : (
        <RoomLobby room={room} onLeave={leaveRoom} />
      )}
    </div>
  );
}

function Lobby() {
  const [name, setName] = useState(localStorage.getItem('presidenten-name') ?? '');
  const [code, setCode] = useState('');

  const saveName = () => {
    const n = name.trim() || 'Speler';
    localStorage.setItem('presidenten-name', n);
    return n;
  };

  const quickPlay = () => {
    socket.emit('createRoom', { name: saveName(), bots: 3 });
    socket.emit('startGame');
  };

  return (
    <div className="lobby">
      <h1>
        Presidenten <span className="suits">♠♥♦♣</span>
      </h1>
      <p className="tagline">Het kaartspel — word president, vermijd de foet!</p>
      <input
        className="input"
        placeholder="Je naam"
        value={name}
        maxLength={20}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn primary" onClick={quickPlay}>
        🤖 Speel tegen de computer
      </button>
      <div className="divider">— of multiplayer —</div>
      <button className="btn" onClick={() => socket.emit('createRoom', { name: saveName(), bots: 0 })}>
        Nieuwe kamer maken
      </button>
      <div className="join-row">
        <input
          className="input"
          placeholder="Kamercode"
          value={code}
          maxLength={4}
          inputMode="numeric"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <button
          className="btn"
          disabled={code.length !== 4}
          onClick={() => socket.emit('joinRoom', { code, name: saveName() })}
        >
          Meedoen
        </button>
      </div>
    </div>
  );
}

function RoomLobby({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  return (
    <div className="lobby">
      <h1>Kamer {room.code}</h1>
      <p className="tagline">Deel deze code met vrienden om mee te doen (3–6 spelers).</p>
      <ul className="seat-list">
        {room.seats.map((s) => (
          <li key={s.id}>
            {s.isBot ? '🤖' : '🧑'} {s.name}
            {!s.isBot && !s.connected && ' (verbroken)'}
          </li>
        ))}
      </ul>
      {room.youAreHost ? (
        <>
          <div className="join-row">
            <button className="btn" onClick={() => socket.emit('addBot')} disabled={room.seats.length >= 6}>
              + Bot
            </button>
            <button
              className="btn"
              onClick={() => socket.emit('removeBot')}
              disabled={!room.seats.some((s) => s.isBot)}
            >
              − Bot
            </button>
          </div>
          <button className="btn primary" onClick={() => socket.emit('startGame')} disabled={room.seats.length < 3}>
            Start het spel ({room.seats.length}/6)
          </button>
          {room.seats.length < 3 && <p className="hint">Minimaal 3 spelers — voeg bots toe of wacht op vrienden.</p>}
        </>
      ) : (
        <p className="hint">Wachten tot de host het spel start…</p>
      )}
      <button className="btn subtle" onClick={onLeave}>
        Kamer verlaten
      </button>
    </div>
  );
}

function Game({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const g = room.game!;
  const [selected, setSelected] = useState<string[]>([]);

  // Clear the selection whenever our hand changes (a play/round happened).
  const handKey = g.hand.map((c) => c.id).join(',');
  useEffect(() => setSelected([]), [handKey, g.phase]);

  const isMyTurn = g.phase === 'playing' && g.turn === g.you;
  const inExchange = g.phase === 'exchange' && g.mustReturn > 0;
  const top = g.trick.length ? g.trick[g.trick.length - 1] : null;

  const toggleCard = (card: CardT) => {
    setSelected((sel) => {
      if (inExchange) {
        if (sel.includes(card.id)) return sel.filter((id) => id !== card.id);
        return sel.length < g.mustReturn ? [...sel, card.id] : sel;
      }
      // Following a trick: clicking one card selects the required set size
      // of that rank automatically (2 for pairs, 3 for triples, ...).
      if (top) {
        if (sel.includes(card.id)) return [];
        const need = top.cards.length;
        const others = g.hand.filter((c) => c.r === card.r && c.id !== card.id);
        return [card.id, ...others.slice(0, need - 1).map((c) => c.id)];
      }
      // Leading: a click selects ALL cards of that rank at once; click a
      // selected card again to take it out of the set (or re-add it later).
      if (sel.includes(card.id)) return sel.filter((id) => id !== card.id);
      const selCards = g.hand.filter((c) => sel.includes(c.id));
      if (selCards.length && selCards[0].r === card.r) return [...sel, card.id];
      return g.hand.filter((c) => c.r === card.r).map((c) => c.id);
    });
  };

  const selectedCards = g.hand.filter((c) => selected.includes(c.id));
  const playLegal = useMemo(() => {
    if (!isMyTurn || selectedCards.length === 0) return false;
    if (!selectedCards.every((c) => c.r === selectedCards[0].r)) return false;
    if (!top) return true;
    return selectedCards.length === top.cards.length && selectedCards[0].r > top.cards[0].r;
  }, [isMyTurn, selectedCards, top]);

  const others = g.players
    .map((p, i) => ({ ...p, idx: i }))
    .filter((p) => p.idx !== g.you);

  const statusLine = () => {
    if (g.phase === 'exchange') {
      if (inExchange) return `Kies ${g.mustReturn} kaart(en) om terug te geven.`;
      return 'Kaarten worden geruild…';
    }
    if (g.phase === 'roundEnd') return 'Ronde afgelopen!';
    if (isMyTurn) return top ? `Jouw beurt: speel ${top.cards.length} hogere kaart(en), of pas.` : 'Jouw beurt: kom uit met één of meer gelijke kaarten.';
    return `${g.players[g.turn].name} is aan de beurt…`;
  };

  return (
    <div className="game">
      <header className="game-header">
        <span className="room-code">Kamer {room.code} · Ronde {g.roundNumber}</span>
        <button className="btn subtle small" onClick={onLeave}>
          Verlaten
        </button>
      </header>

      <div className="opponents">
        {others.map((p) => (
          <div
            key={p.id}
            className={`seat ${g.phase === 'playing' && g.turn === p.idx ? 'active' : ''} ${p.finishPos !== null ? 'done' : ''}`}
          >
            <div className="seat-name">
              {p.isBot ? '🤖' : p.connected ? '🧑' : '📵'} {p.name}
            </div>
            <div className="seat-info">
              {p.role && <span className={`role role-${p.role}`}>{ROLE_LABELS[p.role]}</span>}
              {p.finishPos !== null ? (
                <span className="finished">#{p.finishPos + 1} klaar</span>
              ) : (
                <span className="cardcount">🂠 {p.cardCount}</span>
              )}
              {p.passed && <span className="passed">gepast</span>}
            </div>
            {!p.isBot && !p.connected && (
              <div className="bot-takeover">🤖 bot speelt verder</div>
            )}
          </div>
        ))}
      </div>

      <div className="table-center">
        {g.phase === 'roundEnd' ? (
          <RoundEnd g={g} />
        ) : g.phase === 'exchange' ? (
          <div className="pile-empty">Ruilfase…</div>
        ) : g.trick.length === 0 ? (
          <div className="pile-empty">Nieuwe slag — {g.players[g.turn].name} komt uit</div>
        ) : (
          <div className="trick">
            {g.trick.slice(-4).map((play, i, arr) => (
              <div key={i} className={`trick-play ${i === arr.length - 1 ? 'top' : ''}`}>
                <div className="trick-cards">
                  {play.cards.map((c) => (
                    <PlayingCard key={c.id} card={c} small />
                  ))}
                </div>
                <span className="trick-by">{g.players[play.by].name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="status">{statusLine()}</div>

      <ExchangeBanner g={g} />

      <div className="hand-area">
        <div className="hand">
          {g.hand.map((c) => (
            <PlayingCard
              key={c.id}
              card={c}
              selected={selected.includes(c.id)}
              onClick={() => (isMyTurn || inExchange) && toggleCard(c)}
            />
          ))}
          {g.hand.length === 0 && g.phase === 'playing' && (
            <div className="pile-empty">Je bent klaar! 🎉</div>
          )}
        </div>
        <div className="controls">
          {inExchange && (
            <button
              className="btn primary"
              disabled={selected.length !== g.mustReturn}
              onClick={() => socket.emit('returnCards', { cards: selected })}
            >
              Geef {g.mustReturn} kaart(en) terug
            </button>
          )}
          {g.phase === 'playing' && (
            <>
              <button className="btn primary" disabled={!playLegal} onClick={() => socket.emit('playCards', { cards: selected })}>
                Spelen
              </button>
              <button className="btn" disabled={!isMyTurn || !top} onClick={() => socket.emit('pass')}>
                Passen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function cardNames(cards: { r: number; s: CardT['s'] }[]): string {
  return cards.map((c) => `${rankLabel(c.r)}${SUIT_SYMBOLS[c.s]}`).join(' ');
}

/**
 * Shows what you gave/received in the exchange. Stays visible until the first
 * card of the round is played, so the foet also sees it when the exchange
 * itself finished instantly (bot president).
 */
function ExchangeBanner({ g }: { g: GameView }) {
  if (g.gave.length === 0 && g.received.length === 0) return null;
  const nonePlayedYet = g.players.reduce((sum, p) => sum + p.cardCount, 0) === 52;
  if (g.phase !== 'exchange' && !(g.phase === 'playing' && nonePlayedYet)) return null;

  const role = g.players[g.you].role;
  const counterpart =
    role === 'foet' ? 'de president'
    : role === 'president' ? 'de foet'
    : role === 'vice-foet' ? 'de vice-president'
    : 'de vice-foet';

  return (
    <div className="received">
      {g.gave.length > 0 && <span>Gegeven aan {counterpart}: <b>{cardNames(g.gave)}</b></span>}
      {g.gave.length > 0 && g.received.length > 0 && ' · '}
      {g.received.length > 0 && <span>Ontvangen: <b>{cardNames(g.received)}</b></span>}
    </div>
  );
}

function RoundEnd({ g }: { g: GameView }) {
  return (
    <div className="round-end">
      <h2>Ronde {g.roundNumber} afgelopen</h2>
      <ol className="results">
        {g.finishOrder.map((idx, pos) => {
          const p = g.players[idx];
          return (
            <li key={p.id}>
              <span className="medal">{pos === 0 ? '👑' : pos === g.finishOrder.length - 1 ? '💩' : ''}</span>
              {p.name} — {p.role ? ROLE_LABELS[p.role] : ''}
              {p.wins > 0 && <span className="wins"> ({p.wins}× president)</span>}
            </li>
          );
        })}
      </ol>
      <button className="btn primary" onClick={() => socket.emit('nextRound')}>
        Volgende ronde
      </button>
    </div>
  );
}

const CARD_RANK_FILES: Record<number, string> = {
  11: 'jack',
  12: 'queen',
  13: 'king',
  14: 'ace',
  15: '2',
};
const CARD_SUIT_FILES: Record<CardT['s'], string> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
};

function cardImage(card: CardT): string {
  const rank = CARD_RANK_FILES[card.r] ?? String(card.r);
  return `/cards/${rank}_of_${CARD_SUIT_FILES[card.s]}.svg`;
}

function PlayingCard({
  card,
  selected,
  onClick,
  small,
}: {
  card: CardT;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  const label = `${rankLabel(card.r)}${SUIT_SYMBOLS[card.s]}`;
  return (
    <button
      className={`card ${selected ? 'selected' : ''} ${small ? 'small' : ''}`}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
      aria-label={label}
    >
      <img src={cardImage(card)} alt={label} draggable={false} />
    </button>
  );
}
