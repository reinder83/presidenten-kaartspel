import { Card, RANK_TWO, makeDeck, shuffle, sortHand } from './cards.js';

export type Role = 'president' | 'vice-president' | 'burger' | 'vice-foet' | 'foet';
export type Phase = 'exchange' | 'playing' | 'roundEnd';

export interface TrickPlay {
  by: number;
  cards: Card[];
}

export interface GamePlayer {
  hand: Card[];
  passed: boolean;
  /** 0-based finish position this round, or null while still playing */
  finished: number | null;
  role: Role | null;
  /** Number of cards this player still owes back during the exchange phase */
  mustReturn: number;
  /** Cards received in the exchange (for display) */
  received: Card[];
  /** Cards handed over in the exchange (for display) */
  gave: Card[];
}

export interface PlayResult {
  ok: boolean;
  /** Translation key; the client renders it in the user's language */
  error?: string;
  params?: Record<string, string | number>;
}

/**
 * Presidenten (Dutch "President" card game) rules engine.
 *
 * - Full 52-card deck dealt round-robin; rank order 3..A with 2 highest.
 * - Leader plays any set of equal-ranked cards; followers must match the
 *   count with a strictly higher rank, or pass (out for the rest of the trick).
 * - When everyone else has passed, the last player to play leads the next trick.
 * - A 2 is unbeatable: playing 2s clears the trick immediately and the same
 *   player leads again.
 * - Finish order determines roles; between rounds the foet gives their 2 best
 *   cards to the president (president returns 2 of choice), vice-foet and
 *   vice-president exchange 1. The foet leads the new round.
 */
export class Game {
  players: GamePlayer[] = [];
  phase: Phase = 'playing';
  turn = 0;
  roundNumber = 1;
  /** Plays since the last trick clear; last entry is the play to beat */
  trick: TrickPlay[] = [];
  finishOrder: number[] = [];
  lastEvent = '';

  constructor(public numPlayers: number) {
    for (let i = 0; i < numPlayers; i++) {
      this.players.push({ hand: [], passed: false, finished: null, role: null, mustReturn: 0, received: [], gave: [] });
    }
    this.deal();
    // First round: holder of the 3 of clubs leads.
    this.turn = this.players.findIndex((p) => p.hand.some((c) => c.id === '3C'));
    if (this.turn < 0) this.turn = 0;
    this.phase = 'playing';
  }

  private deal() {
    const deck = shuffle(makeDeck());
    this.players.forEach((p) => {
      p.hand = [];
      p.passed = false;
      p.finished = null;
      p.mustReturn = 0;
      p.received = [];
      p.gave = [];
    });
    let i = 0;
    for (const card of deck) {
      this.players[i % this.numPlayers].hand.push(card);
      i++;
    }
    this.players.forEach((p) => sortHand(p.hand));
    this.trick = [];
    this.finishOrder = [];
  }

  get topPlay(): TrickPlay | null {
    return this.trick.length ? this.trick[this.trick.length - 1] : null;
  }

  private isActive(i: number): boolean {
    return this.players[i].finished === null;
  }

  private nextActive(from: number, skipPassed: boolean): number {
    let i = from;
    for (let step = 0; step < this.numPlayers; step++) {
      i = (i + 1) % this.numPlayers;
      if (this.isActive(i) && (!skipPassed || !this.players[i].passed)) return i;
    }
    return from;
  }

  /** Validate that `cards` are in the player's hand and form a legal play right now. */
  validatePlay(playerIdx: number, cardIds: string[]): PlayResult {
    if (this.phase !== 'playing') return { ok: false, error: 'errNotPlaying' };
    if (playerIdx !== this.turn) return { ok: false, error: 'errNotYourTurn' };
    const hand = this.players[playerIdx].hand;
    const cards = cardIds.map((id) => hand.find((c) => c.id === id));
    if (cards.some((c) => !c)) return { ok: false, error: 'errCardNotInHand' };
    if (new Set(cardIds).size !== cardIds.length) return { ok: false, error: 'errDuplicateCards' };
    const set = cards as Card[];
    if (set.length === 0) return { ok: false, error: 'errSelectAtLeast' };
    if (!set.every((c) => c.r === set[0].r)) return { ok: false, error: 'errSameRank' };
    const top = this.topPlay;
    if (top) {
      if (set.length !== top.cards.length) {
        return { ok: false, error: 'errExactCount', params: { n: top.cards.length } };
      }
      if (set[0].r <= top.cards[0].r) {
        return { ok: false, error: 'errMustBeHigher' };
      }
    }
    return { ok: true };
  }

  play(playerIdx: number, cardIds: string[]): PlayResult {
    const valid = this.validatePlay(playerIdx, cardIds);
    if (!valid.ok) return valid;
    const player = this.players[playerIdx];
    const cards = cardIds.map((id) => player.hand.find((c) => c.id === id)!);
    player.hand = player.hand.filter((c) => !cardIds.includes(c.id));
    this.trick.push({ by: playerIdx, cards });
    this.lastEvent = '';

    if (player.hand.length === 0) {
      player.finished = this.finishOrder.length;
      this.finishOrder.push(playerIdx);
    }

    if (this.remainingActive() <= 1) {
      this.endRound();
      return { ok: true };
    }

    // A 2 is unbeatable: the trick is cleared immediately and the player leads again.
    if (cards[0].r === RANK_TWO) {
      this.clearTrick(playerIdx);
      return { ok: true };
    }

    // If nobody can respond (everyone else active has passed), clear the trick.
    if (this.othersAllPassed(playerIdx)) {
      this.clearTrick(playerIdx);
    } else {
      this.turn = this.nextActive(playerIdx, true);
    }
    return { ok: true };
  }

  pass(playerIdx: number): PlayResult {
    if (this.phase !== 'playing') return { ok: false, error: 'errNotPlaying' };
    if (playerIdx !== this.turn) return { ok: false, error: 'errNotYourTurn' };
    if (!this.topPlay) return { ok: false, error: 'errLeaderCannotPass' };
    this.players[playerIdx].passed = true;

    const lastBy = this.topPlay.by;
    if (this.othersAllPassed(lastBy)) {
      this.clearTrick(lastBy);
    } else {
      this.turn = this.nextActive(playerIdx, true);
    }
    return { ok: true };
  }

  /** True when every active player except `exceptIdx` has passed. */
  private othersAllPassed(exceptIdx: number): boolean {
    return this.players.every(
      (p, i) => i === exceptIdx || p.finished !== null || p.passed
    );
  }

  private clearTrick(winnerIdx: number) {
    this.players.forEach((p) => (p.passed = false));
    this.trick = [];
    // Winner leads; if they finished with their last play, the next active player leads.
    this.turn = this.isActive(winnerIdx) ? winnerIdx : this.nextActive(winnerIdx, false);
    this.lastEvent = 'trickCleared';
  }

  private remainingActive(): number {
    return this.players.filter((p) => p.finished === null).length;
  }

  private endRound() {
    // Last remaining player gets the final finish position.
    const last = this.players.findIndex((p) => p.finished === null);
    if (last >= 0) {
      this.players[last].finished = this.finishOrder.length;
      this.finishOrder.push(last);
    }
    this.assignRoles();
    this.phase = 'roundEnd';
    this.trick = [];
  }

  private assignRoles() {
    const n = this.numPlayers;
    this.finishOrder.forEach((playerIdx, pos) => {
      let role: Role = 'burger';
      if (pos === 0) role = 'president';
      else if (pos === n - 1) role = 'foet';
      else if (n >= 4 && pos === 1) role = 'vice-president';
      else if (n >= 4 && pos === n - 2) role = 'vice-foet';
      this.players[playerIdx].role = role;
    });
  }

  private roleIdx(role: Role): number {
    return this.players.findIndex((p) => p.role === role);
  }

  /** Start the next round: deal, run the automatic half of the exchange, wait for returns. */
  nextRound() {
    this.roundNumber++;
    this.deal();

    const pres = this.roleIdx('president');
    const foet = this.roleIdx('foet');
    const vp = this.roleIdx('vice-president');
    const vf = this.roleIdx('vice-foet');

    // Foet automatically hands over their best cards; president owes cards back.
    this.autoGiveBest(foet, pres, 2);
    this.players[pres].mustReturn = 2;
    if (vp >= 0 && vf >= 0) {
      this.autoGiveBest(vf, vp, 1);
      this.players[vp].mustReturn = 1;
    }

    this.phase = 'exchange';
    // The foet leads the new round.
    this.turn = foet;
  }

  private autoGiveBest(fromIdx: number, toIdx: number, count: number) {
    const from = this.players[fromIdx];
    const to = this.players[toIdx];
    const best = [...from.hand].sort((a, b) => b.r - a.r).slice(0, count);
    from.hand = from.hand.filter((c) => !best.includes(c));
    from.gave = best;
    to.hand.push(...best);
    to.received = best;
    sortHand(to.hand);
  }

  /** President / vice-president returns cards of their choice to foet / vice-foet. */
  returnCards(playerIdx: number, cardIds: string[]): PlayResult {
    if (this.phase !== 'exchange') return { ok: false, error: 'errNoExchange' };
    const player = this.players[playerIdx];
    if (player.mustReturn === 0) return { ok: false, error: 'errNothingToReturn' };
    if (cardIds.length !== player.mustReturn) {
      return { ok: false, error: 'errChooseExact', params: { n: player.mustReturn } };
    }
    const cards = cardIds.map((id) => player.hand.find((c) => c.id === id));
    if (cards.some((c) => !c)) return { ok: false, error: 'errCardNotInHand' };

    const targetRole: Role = player.role === 'president' ? 'foet' : 'vice-foet';
    const target = this.players[this.roleIdx(targetRole)];
    player.hand = player.hand.filter((c) => !cardIds.includes(c.id));
    player.gave = cards as Card[];
    target.hand.push(...(cards as Card[]));
    target.received = cards as Card[];
    sortHand(target.hand);
    player.mustReturn = 0;

    if (this.players.every((p) => p.mustReturn === 0)) {
      this.phase = 'playing';
    }
    return { ok: true };
  }

  /** All legal plays for the current player (used by bots and for hints). */
  legalPlays(playerIdx: number): Card[][] {
    if (this.phase !== 'playing' || playerIdx !== this.turn) return [];
    const hand = this.players[playerIdx].hand;
    const byRank = new Map<number, Card[]>();
    for (const c of hand) {
      byRank.set(c.r, [...(byRank.get(c.r) ?? []), c]);
    }
    const top = this.topPlay;
    const plays: Card[][] = [];
    for (const [r, cards] of byRank) {
      if (top) {
        if (r > top.cards[0].r && cards.length >= top.cards.length) {
          plays.push(cards.slice(0, top.cards.length));
        }
      } else {
        for (let n = 1; n <= cards.length; n++) plays.push(cards.slice(0, n));
      }
    }
    return plays.sort((a, b) => a[0].r - b[0].r || a.length - b.length);
  }
}
