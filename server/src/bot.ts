import { Card, RANK_TWO } from './cards.js';
import { Game } from './game.js';

/**
 * Simple heuristic bot:
 * - When following, play the lowest legal set; save 2s unless few cards remain
 *   or nothing else is legal late in the trick.
 * - When leading, lead the largest set of the lowest rank (dump low cards).
 * - Prefers not to break up bigger sets to follow a smaller one.
 * - During the exchange, returns its lowest cards.
 */
export function botChoosePlay(game: Game, playerIdx: number): Card[] | null {
  const plays = game.legalPlays(playerIdx);
  if (plays.length === 0) return null;

  const hand = game.players[playerIdx].hand;
  const top = game.topPlay;

  if (!top) {
    // Leading: lowest rank first, and play the whole set of that rank.
    const lowestRank = plays[0][0].r;
    const ofRank = plays.filter((p) => p[0].r === lowestRank);
    return ofRank[ofRank.length - 1];
  }

  const countOf = (r: number) => hand.filter((c) => c.r === r).length;
  const needed = top.cards.length;

  // Prefer plays that don't break up a larger set and don't spend a 2 early.
  const scored = plays.map((p) => {
    const r = p[0].r;
    let score = r; // lower rank preferred
    if (countOf(r) > needed) score += 3; // breaking a set costs extra
    if (r === RANK_TWO && hand.length > 4) score += 6; // hold 2s for later
    return { p, score };
  });
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];

  // Pass instead of dumping a high card into a trick when still holding many cards.
  if (best.p[0].r >= 13 && best.p[0].r > top.cards[0].r + 3 && hand.length > 6 && Math.random() < 0.5) {
    return null;
  }
  return best.p;
}

export function botChooseReturn(game: Game, playerIdx: number): string[] {
  const player = game.players[playerIdx];
  return [...player.hand]
    .sort((a, b) => a.r - b.r)
    .slice(0, player.mustReturn)
    .map((c) => c.id);
}
