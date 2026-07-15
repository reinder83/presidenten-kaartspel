export type Suit = 'S' | 'H' | 'D' | 'C';

export interface Card {
  /** Rank value: 3..10 = pip, 11 = J, 12 = Q, 13 = K, 14 = A, 15 = 2 (highest) */
  r: number;
  s: Suit;
  id: string;
}

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANK_TWO = 15;

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (let r = 3; r <= 15; r++) {
      deck.push({ r, s, id: `${r}${s}` });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sortHand(hand: Card[]): Card[] {
  return hand.sort((a, b) => a.r - b.r || a.s.localeCompare(b.s));
}

export function rankLabel(r: number): string {
  if (r <= 10) return String(r);
  return { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' }[r]!;
}
