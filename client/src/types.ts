export type Suit = 'S' | 'H' | 'D' | 'C';

export interface Card {
  r: number;
  s: Suit;
  id: string;
}

export type Role = 'president' | 'vice-president' | 'burger' | 'vice-foet' | 'foet';
export type Phase = 'exchange' | 'playing' | 'roundEnd';

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

/** The role a finish position will earn, mirroring the server's assignRoles. */
export function roleForFinishPos(pos: number, numPlayers: number): Role {
  if (pos === 0) return 'president';
  if (pos === numPlayers - 1) return 'foet';
  if (numPlayers >= 4 && pos === 1) return 'vice-president';
  if (numPlayers >= 4 && pos === numPlayers - 2) return 'vice-foet';
  return 'burger';
}

export interface LogEntry {
  t: 'round' | 'play' | 'pass' | 'won' | 'done';
  by?: number;
  cards?: Card[];
  pos?: number;
  n?: number;
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

export interface SeatView {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
}

export interface RoomView {
  code: string;
  youAreHost: boolean;
  seats: SeatView[];
  game: GameView | null;
}

export const SUIT_SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
