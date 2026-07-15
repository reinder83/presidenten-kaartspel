import { useEffect, useMemo, useRef, useState } from 'react';
import { socket } from './socket';
import {
  Card as CardT,
  GameView,
  LogEntry,
  Role,
  RoomView,
  SUIT_SYMBOLS,
  roleForFinishPos,
} from './types';
import {
  Lang,
  LangContext,
  ServerMessage,
  detectLang,
  rankLabel,
  roleKey,
  useLang,
  useT,
} from './i18n';

type Toast = ServerMessage | string;

export default function App() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<Toast | null>(null);
  const [notice, setNotice] = useState<Toast | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [lang, setLangState] = useState<Lang>(detectLang);
  const roomRef = useRef<RoomView | null>(null);
  roomRef.current = room;

  const setLang = (l: Lang) => {
    localStorage.setItem('presidenten-lang', l);
    setLangState(l);
  };

  useEffect(() => {
    const onRoom = (r: RoomView) => setRoom(r);
    const onError = (msg: Toast) => {
      setError(msg);
      setTimeout(() => setError(null), 4000);
    };
    const onNotice = (msg: Toast) => {
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
      setError({ key: 'roomGone' });
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
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="app">
        {error && <ToastView toast={error} kind="" />}
        {notice && <ToastView toast={notice} kind="info" />}
        {!connected && <ToastView toast={{ key: 'connLost' }} kind="" />}
        {!room ? (
          <Lobby />
        ) : room.game ? (
          <Game room={room} onLeave={leaveRoom} />
        ) : (
          <RoomLobby room={room} onLeave={leaveRoom} />
        )}
      </div>
    </LangContext.Provider>
  );
}

function ToastView({ toast, kind }: { toast: Toast; kind: string }) {
  const t = useT();
  const text = typeof toast === 'string' ? toast : t(toast.key, toast.params);
  return <div className={`toast ${kind}`}>{text}</div>;
}

function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switch">
      {(['nl', 'en'] as Lang[]).map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Lobby() {
  const t = useT();
  const [name, setName] = useState(localStorage.getItem('presidenten-name') ?? '');
  const [code, setCode] = useState('');
  const [numPlayers, setNumPlayers] = useState(() => {
    const saved = Number(localStorage.getItem('presidenten-players'));
    return saved >= 3 && saved <= 6 ? saved : 4;
  });

  const saveName = () => {
    const n = name.trim() || t('defaultName');
    localStorage.setItem('presidenten-name', n);
    return n;
  };

  const quickPlay = () => {
    localStorage.setItem('presidenten-players', String(numPlayers));
    socket.emit('createRoom', { name: saveName(), bots: numPlayers - 1 });
    socket.emit('startGame');
  };

  return (
    <div className="lobby">
      <LangSwitch />
      <h1>
        Presidenten <span className="suits">♠♥♦♣</span>
      </h1>
      <p className="tagline">{t('tagline')}</p>
      <input
        className="input"
        placeholder={t('yourName')}
        value={name}
        maxLength={20}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="player-count">
        <span className="player-count-label">{t('playerCount')}</span>
        {[3, 4, 5, 6].map((n) => (
          <button
            key={n}
            className={`btn count ${numPlayers === n ? 'on' : ''}`}
            onClick={() => setNumPlayers(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <button className="btn primary" onClick={quickPlay}>
        {t('playVsComputer')}
      </button>
      <div className="divider">{t('orMultiplayer')}</div>
      <button className="btn" onClick={() => socket.emit('createRoom', { name: saveName(), bots: 0 })}>
        {t('createRoom')}
      </button>
      <div className="join-row">
        <input
          className="input"
          placeholder={t('roomCode')}
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
          {t('join')}
        </button>
      </div>
    </div>
  );
}

function RoomLobby({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const t = useT();
  return (
    <div className="lobby">
      <LangSwitch />
      <h1>{t('roomTitle', { code: room.code })}</h1>
      <p className="tagline">{t('shareCode')}</p>
      <ul className="seat-list">
        {room.seats.map((s) => (
          <li key={s.id}>
            {s.isBot ? '🤖' : '🧑'} {s.name}
            {!s.isBot && !s.connected && ` ${t('disconnected')}`}
          </li>
        ))}
      </ul>
      {room.youAreHost ? (
        <>
          <div className="join-row">
            <button className="btn" onClick={() => socket.emit('addBot')} disabled={room.seats.length >= 6}>
              {t('addBot')}
            </button>
            <button
              className="btn"
              onClick={() => socket.emit('removeBot')}
              disabled={!room.seats.some((s) => s.isBot)}
            >
              {t('removeBot')}
            </button>
          </div>
          <button
            className="btn primary"
            onClick={() => socket.emit('startGame')}
            disabled={room.seats.length < 3}
          >
            {t('startGame', { n: room.seats.length })}
          </button>
          {room.seats.length < 3 && <p className="hint">{t('minPlayers')}</p>}
        </>
      ) : (
        <p className="hint">{t('waitingHost')}</p>
      )}
      <button className="btn subtle" onClick={onLeave}>
        {t('leaveRoom')}
      </button>
    </div>
  );
}

function Game({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const t = useT();
  const g = room.game!;
  const [selected, setSelected] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(() => localStorage.getItem('presidenten-log') === '1');

  const toggleLog = () => {
    setShowLog((v) => {
      localStorage.setItem('presidenten-log', v ? '0' : '1');
      return !v;
    });
  };

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

  // Cards that can be part of a legal play right now; null = everything can.
  const playableIds = useMemo(() => {
    if (!isMyTurn || !top) return null;
    const countByRank = new Map<number, number>();
    g.hand.forEach((c) => countByRank.set(c.r, (countByRank.get(c.r) ?? 0) + 1));
    const need = top.cards.length;
    const topRank = top.cards[0].r;
    return new Set(
      g.hand.filter((c) => c.r > topRank && (countByRank.get(c.r) ?? 0) >= need).map((c) => c.id)
    );
  }, [isMyTurn, top, g.hand]);

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
      if (inExchange) return t('statusExchangeChoose', { n: g.mustReturn });
      return t('statusExchanging');
    }
    if (g.phase === 'roundEnd') return t('statusRoundOver');
    if (isMyTurn) {
      return top
        ? t('statusYourTurnFollow', { n: top.cards.length })
        : t('statusYourTurnLead');
    }
    return t('statusOtherTurn', { name: g.players[g.turn].name });
  };

  return (
    <div className="game">
      <header className="game-header">
        <span className="room-code">{t('headerRoom', { code: room.code, round: g.roundNumber })}</span>
        <span className="header-right">
          <button className={`btn small log-toggle ${showLog ? 'on' : ''}`} onClick={toggleLog}>
            {t('logToggle')}
          </button>
          <LangSwitch />
          <button className="btn subtle small" onClick={onLeave}>
            {t('leave')}
          </button>
        </span>
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
              {p.role && <span className={`role role-${p.role}`}>{t(roleKey(p.role))}</span>}
              {p.finishPos !== null ? (
                <span className="finished">{t('finishedPos', { pos: p.finishPos + 1 })}</span>
              ) : (
                <span className="cardcount">🂠 {p.cardCount}</span>
              )}
              {p.passed && <span className="passed">{t('passed')}</span>}
            </div>
            {!p.isBot && !p.connected && <div className="bot-takeover">{t('botPlaysOn')}</div>}
          </div>
        ))}
      </div>

      <div className="table-center">
        {g.phase === 'roundEnd' ? (
          <RoundEnd g={g} />
        ) : g.phase === 'exchange' ? (
          <div className="pile-empty">{t('exchangePhase')}</div>
        ) : g.trick.length === 0 ? (
          <div className="pile-empty">{t('newTrick', { name: g.players[g.turn].name })}</div>
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

      {showLog && <LogPanel g={g} />}

      <div className={`hand-area ${isMyTurn || inExchange ? 'active' : ''}`}>
        <div className="hand">
          {g.hand.map((c) => {
            const dimmed = playableIds !== null && !playableIds.has(c.id);
            return (
              <PlayingCard
                key={c.id}
                card={c}
                selected={selected.includes(c.id)}
                dimmed={dimmed}
                onClick={() => (isMyTurn || inExchange) && !dimmed && toggleCard(c)}
              />
            );
          })}
          {g.hand.length === 0 && g.phase === 'playing' && (
            <div className="finished-self">
              <div className="pile-empty">{t('youAreDone')}</div>
              {g.players[g.you].finishPos !== null && (
                <div className="finished-role">
                  {t('yourRank')}{' '}
                  <b>{t(roleKey(roleForFinishPos(g.players[g.you].finishPos!, g.players.length)))}</b>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="controls">
          {inExchange && (
            <button
              className="btn primary"
              disabled={selected.length !== g.mustReturn}
              onClick={() => socket.emit('returnCards', { cards: selected })}
            >
              {t('giveBack', { n: g.mustReturn })}
            </button>
          )}
          {g.phase === 'playing' && (
            <>
              <button className="btn primary" disabled={!playLegal} onClick={() => socket.emit('playCards', { cards: selected })}>
                {t('play')}
              </button>
              <button className="btn" disabled={!isMyTurn || !top} onClick={() => socket.emit('pass')}>
                {t('pass')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Scrollable history of everything that was played, newest at the bottom. */
function LogPanel({ g }: { g: GameView }) {
  const t = useT();
  const { lang } = useLang();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [g.log.length]);

  const cardNames = (cards: CardT[]) =>
    cards.map((c) => `${rankLabel(c.r, lang)}${SUIT_SYMBOLS[c.s]}`).join(' ');

  const line = (e: LogEntry) => {
    const name = e.by !== undefined ? g.players[e.by]?.name ?? '?' : '';
    switch (e.t) {
      case 'round':
        return t('logRound', { n: e.n! });
      case 'play':
        return t('logPlay', { name, cards: cardNames(e.cards ?? []) });
      case 'pass':
        return t('logPass', { name });
      case 'won':
        return t('logWon', { name });
      case 'done':
        return t('logDone', { name, pos: e.pos! });
    }
  };

  return (
    <div className="log-panel">
      <div className="log-title">{t('logTitle')}</div>
      <div className="log-body" ref={bodyRef}>
        {g.log.map((e, i) => (
          <div key={i} className={`log-entry ${e.t === 'round' ? 'log-round' : ''} ${e.t === 'won' || e.t === 'done' ? 'log-strong' : ''}`}>
            {line(e)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shows what you gave/received in the exchange. Stays visible until the first
 * card of the round is played, so the foet also sees it when the exchange
 * itself finished instantly (bot president).
 */
function ExchangeBanner({ g }: { g: GameView }) {
  const t = useT();
  const { lang } = useLang();
  if (g.gave.length === 0 && g.received.length === 0) return null;
  const nonePlayedYet = g.players.reduce((sum, p) => sum + p.cardCount, 0) === 52;
  if (g.phase !== 'exchange' && !(g.phase === 'playing' && nonePlayedYet)) return null;

  const cardNames = (cards: { r: number; s: CardT['s'] }[]) =>
    cards.map((c) => `${rankLabel(c.r, lang)}${SUIT_SYMBOLS[c.s]}`).join(' ');

  const role = g.players[g.you].role;
  const counterpart =
    role === 'foet' ? t('thePresident')
    : role === 'president' ? t('theFoet')
    : role === 'vice-foet' ? t('theVicePresident')
    : t('theViceFoet');

  return (
    <div className="received">
      {g.gave.length > 0 && (
        <span>
          {t('givenTo', { who: counterpart })} <b>{cardNames(g.gave)}</b>
        </span>
      )}
      {g.gave.length > 0 && g.received.length > 0 && ' · '}
      {g.received.length > 0 && (
        <span>
          {t('received')} <b>{cardNames(g.received)}</b>
        </span>
      )}
    </div>
  );
}

function RoundEnd({ g }: { g: GameView }) {
  const t = useT();
  const n = g.players.length;
  const columns: Role[] =
    n >= 4
      ? ['president', 'vice-president', 'burger', 'vice-foet', 'foet']
      : ['president', 'burger', 'foet'];
  const colKeys: Record<Role, string> = {
    president: 'colPresident',
    'vice-president': 'colVicePresident',
    burger: 'colBurger',
    'vice-foet': 'colViceFoet',
    foet: 'colFoet',
  };

  return (
    <div className="round-end">
      <h2>{t('roundOverTitle', { n: g.roundNumber })}</h2>
      <ol className="results">
        {g.finishOrder.map((idx, pos) => {
          const p = g.players[idx];
          return (
            <li key={p.id}>
              <span className="medal">{pos === 0 ? '👑' : pos === g.finishOrder.length - 1 ? '💩' : ''}</span>
              {p.name} — {p.role ? t(roleKey(p.role)) : ''}
            </li>
          );
        })}
      </ol>
      <table className="role-stats">
        <caption>{t('totals')}</caption>
        <thead>
          <tr>
            <th></th>
            {columns.map((r) => (
              <th key={r}>{t(colKeys[r])}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.players.map((p) => (
            <tr key={p.id}>
              <td className="stats-name">{p.name}</td>
              {columns.map((r) => (
                <td key={r}>{p.roleCounts[r] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn primary" onClick={() => socket.emit('nextRound')}>
        {t('nextRound')}
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
  dimmed,
  onClick,
  small,
}: {
  card: CardT;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  const { lang } = useLang();
  const label = `${rankLabel(card.r, lang)}${SUIT_SYMBOLS[card.s]}`;
  return (
    <button
      className={`card ${selected ? 'selected' : ''} ${small ? 'small' : ''} ${dimmed ? 'dimmed' : ''}`}
      onClick={onClick}
      tabIndex={onClick && !dimmed ? 0 : -1}
      aria-label={label}
      aria-disabled={dimmed || undefined}
    >
      <img src={cardImage(card)} alt={label} draggable={false} />
    </button>
  );
}
