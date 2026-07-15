import { Server } from 'socket.io';
import { Card } from './cards.js';
import { Game, LogEntry, Phase, Role } from './game.js';
import { botChoosePlay, botChooseReturn } from './bot.js';

export interface Seat {
  id: string;
  token: string;
  name: string;
  isBot: boolean;
  socketId: string | null;
  /** How often this seat finished as president, foet, etc. across rounds */
  roleCounts: Partial<Record<Role, number>>;
}

export interface PlayerView {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  cardCount: number;
  role: Role | null;
  passed: boolean;
  finishPos: number | null;
  mustReturn: number;
  roleCounts: Partial<Record<Role, number>>;
}

export interface GameView {
  phase: Phase;
  roundNumber: number;
  players: PlayerView[];
  you: number;
  hand: Card[];
  turn: number;
  trick: { by: number; cards: Card[] }[];
  mustReturn: number;
  received: Card[];
  gave: Card[];
  finishOrder: number[];
  lastEvent: string;
  log: LogEntry[];
}

const BOT_NAMES = ['Willem', 'Máxima', 'Beatrix', 'Juliana', 'Bernhard', 'Amalia', 'Claus'];
const BOT_DELAY_MS = 1000;

export class Room {
  seats: Seat[] = [];
  game: Game | null = null;
  hostToken: string | null = null;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private roundRecorded = false;

  constructor(public code: string, private io: Server) {}

  addHuman(name: string, token: string, socketId: string): Seat {
    const seat: Seat = { id: `p${this.seats.length}-${token.slice(0, 6)}`, token, name, isBot: false, socketId, roleCounts: {} };
    this.seats.push(seat);
    if (!this.hostToken) this.hostToken = token;
    return seat;
  }

  addBot(): Seat | null {
    if (this.seats.length >= 6) return null;
    const used = new Set(this.seats.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${this.seats.length + 1}`;
    const seat: Seat = { id: `bot-${this.seats.length}-${Math.random().toString(36).slice(2, 8)}`, token: '', name, isBot: true, socketId: null, roleCounts: {} };
    this.seats.push(seat);
    return seat;
  }

  removeSeat(index: number) {
    const [removed] = this.seats.splice(index, 1);
    if (removed && this.hostToken === removed.token) {
      const nextHuman = this.seats.find((s) => !s.isBot);
      this.hostToken = nextHuman ? nextHuman.token : null;
    }
  }

  seatByToken(token: string): number {
    return this.seats.findIndex((s) => !s.isBot && s.token === token);
  }

  get isEmpty(): boolean {
    return !this.seats.some((s) => !s.isBot && s.socketId);
  }

  startGame(): string | null {
    if (this.seats.length < 3) return 'errMinPlayers';
    if (this.seats.length > 6) return 'errMaxPlayers';
    this.game = new Game(this.seats.length);
    this.roundRecorded = false;
    this.broadcast();
    this.scheduleBots();
    return null;
  }

  nextRound() {
    if (!this.game || this.game.phase !== 'roundEnd') return;
    this.roundRecorded = false;
    this.game.nextRound();
    // Bots return exchange cards immediately.
    this.game.players.forEach((p, i) => {
      if (p.mustReturn > 0 && this.seats[i].isBot) {
        this.game!.returnCards(i, botChooseReturn(this.game!, i));
      }
    });
    this.broadcast();
    this.scheduleBots();
  }

  /** Show an informational message to everyone in the room. */
  notice(key: string, params?: Record<string, string | number>) {
    this.io.to(this.code).emit('notice', { key, params });
  }

  /** Once per round, tally the achieved roles into the seat statistics. */
  private recordRoundIfEnded() {
    if (!this.game || this.game.phase !== 'roundEnd' || this.roundRecorded) return;
    this.roundRecorded = true;
    this.game.players.forEach((p, i) => {
      if (p.role) {
        this.seats[i].roleCounts[p.role] = (this.seats[i].roleCounts[p.role] ?? 0) + 1;
      }
    });
  }

  /** Send each connected player their personalised view of the game. */
  broadcast() {
    this.recordRoundIfEnded();
    for (const seat of this.seats) {
      if (seat.socketId) {
        this.io.to(seat.socketId).emit('room', this.roomView(seat));
      }
    }
  }

  roomView(seat: Seat) {
    return {
      code: this.code,
      youAreHost: seat.token === this.hostToken,
      seats: this.seats.map((s) => ({ id: s.id, name: s.name, isBot: s.isBot, connected: s.isBot || !!s.socketId })),
      game: this.game ? this.gameView(this.seats.indexOf(seat)) : null,
    };
  }

  gameView(youIdx: number): GameView {
    const g = this.game!;
    return {
      phase: g.phase,
      roundNumber: g.roundNumber,
      players: g.players.map((p, i) => ({
        id: this.seats[i].id,
        name: this.seats[i].name,
        isBot: this.seats[i].isBot,
        connected: this.seats[i].isBot || !!this.seats[i].socketId,
        cardCount: p.hand.length,
        role: p.role,
        passed: p.passed,
        finishPos: p.finished,
        mustReturn: p.mustReturn,
        roleCounts: this.seats[i].roleCounts,
      })),
      you: youIdx,
      hand: g.players[youIdx]?.hand ?? [],
      turn: g.turn,
      trick: g.trick.slice(-8),
      mustReturn: g.players[youIdx]?.mustReturn ?? 0,
      received: g.players[youIdx]?.received ?? [],
      gave: g.players[youIdx]?.gave ?? [],
      finishOrder: g.finishOrder,
      lastEvent: g.lastEvent,
      log: g.log.slice(-60),
    };
  }

  /** Let bots (and disconnected humans, so games never stall) take their turns. */
  scheduleBots() {
    if (this.botTimer) clearTimeout(this.botTimer);
    const g = this.game;
    if (!g) return;

    if (g.phase === 'exchange') {
      // A disconnected human who owes cards: auto-return lowest after a delay.
      const idx = g.players.findIndex((p, i) => p.mustReturn > 0 && !this.seats[i].isBot && !this.seats[i].socketId);
      if (idx >= 0) {
        this.botTimer = setTimeout(() => {
          g.returnCards(idx, botChooseReturn(g, idx));
          this.broadcast();
          this.scheduleBots();
        }, BOT_DELAY_MS * 3);
      }
      return;
    }

    if (g.phase === 'roundEnd') {
      // If no connected human is present to click "next round", continue automatically.
      if (this.seats.every((s) => s.isBot || !s.socketId)) {
        this.botTimer = setTimeout(() => this.nextRound(), BOT_DELAY_MS * 5);
      }
      return;
    }

    if (g.phase !== 'playing') return;
    const seat = this.seats[g.turn];
    const isUnattended = seat.isBot || !seat.socketId;
    if (!isUnattended) return;

    this.botTimer = setTimeout(() => {
      const idx = g.turn;
      const play = botChoosePlay(g, idx);
      if (play && (play.length > 0)) {
        g.play(idx, play.map((c) => c.id));
      } else if (g.topPlay) {
        g.pass(idx);
      } else {
        // Leader must play; legalPlays is never empty for a leader with cards.
        const plays = g.legalPlays(idx);
        if (plays.length) g.play(idx, plays[0].map((c) => c.id));
      }
      this.broadcast();
      this.scheduleBots();
    }, seat.isBot ? BOT_DELAY_MS : BOT_DELAY_MS * 3);
  }
}
