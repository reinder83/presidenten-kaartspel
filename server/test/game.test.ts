import test from 'node:test';
import assert from 'node:assert';
import { Game } from '../src/game.js';
import { botChoosePlay, botChooseReturn } from '../src/bot.js';

function playRound(game: Game) {
  let steps = 0;
  while (game.phase === 'playing') {
    if (++steps > 2000) throw new Error('Round did not finish (stall)');
    const idx = game.turn;
    const play = botChoosePlay(game, idx);
    if (play) {
      const res = game.play(idx, play.map((c) => c.id));
      assert.ok(res.ok, res.error);
    } else if (game.topPlay) {
      const res = game.pass(idx);
      assert.ok(res.ok, res.error);
    } else {
      const plays = game.legalPlays(idx);
      assert.ok(plays.length > 0, 'leader must always have a legal play');
      const res = game.play(idx, plays[0].map((c) => c.id));
      assert.ok(res.ok, res.error);
    }
  }
}

for (const n of [3, 4, 5, 6]) {
  test(`full game with ${n} bots completes and assigns roles`, () => {
    for (let rep = 0; rep < 20; rep++) {
      const game = new Game(n);
      const total = game.players.reduce((s, p) => s + p.hand.length, 0);
      assert.strictEqual(total, 52);

      playRound(game);
      assert.strictEqual(game.phase, 'roundEnd');
      assert.strictEqual(game.finishOrder.length, n);
      assert.strictEqual(game.players[game.finishOrder[0]].role, 'president');
      assert.strictEqual(game.players[game.finishOrder[n - 1]].role, 'foet');
      if (n >= 4) {
        assert.strictEqual(game.players[game.finishOrder[1]].role, 'vice-president');
        assert.strictEqual(game.players[game.finishOrder[n - 2]].role, 'vice-foet');
      }

      // Second round with exchange.
      game.nextRound();
      assert.strictEqual(game.phase, 'exchange');
      for (let i = 0; i < n; i++) {
        if (game.players[i].mustReturn > 0) {
          const res = game.returnCards(i, botChooseReturn(game, i));
          assert.ok(res.ok, res.error);
        }
      }
      assert.strictEqual(game.phase, 'playing');
      const total2 = game.players.reduce((s, p) => s + p.hand.length, 0);
      assert.strictEqual(total2, 52);
      // Both sides of the exchange are recorded for display.
      const pres = game.players.find((p) => p.role === 'president')!;
      const foet = game.players.find((p) => p.role === 'foet')!;
      assert.strictEqual(foet.gave.length, 2);
      assert.strictEqual(foet.received.length, 2);
      assert.strictEqual(pres.gave.length, 2);
      assert.strictEqual(pres.received.length, 2);
      // The foet hands over their highest cards.
      const foetMax = Math.max(...foet.hand.map((c) => c.r));
      assert.ok(foet.gave.every((c) => c.r >= foetMax));
      // Foet leads the new round.
      assert.strictEqual(game.players[game.turn].role, 'foet');

      playRound(game);
      assert.strictEqual(game.phase, 'roundEnd');
    }
  });
}

test('illegal plays are rejected', () => {
  const game = new Game(4);
  const idx = game.turn;
  const other = (idx + 1) % 4;
  assert.strictEqual(game.play(other, [game.players[other].hand[0].id]).ok, false);
  assert.strictEqual(game.pass(idx).ok, false); // leader may not pass
  const low = game.players[idx].hand[0];
  const high = game.players[idx].hand[game.players[idx].hand.length - 1];
  if (low.r !== high.r) {
    assert.strictEqual(game.play(idx, [low.id, high.id]).ok, false); // mixed ranks
  }
  assert.strictEqual(game.play(idx, ['9X']).ok, false); // not in hand
});

test('follow must match count and be strictly higher', () => {
  const game = new Game(4);
  const leader = game.turn;
  const plays = game.legalPlays(leader);
  const single = plays.find((p) => p.length === 1)!;
  assert.ok(game.play(leader, single.map((c) => c.id)).ok);
  const next = game.turn;
  const notHigher = game.players[next].hand.filter((c) => c.r <= single[0].r && c.r !== 15);
  if (notHigher.length) {
    assert.strictEqual(game.play(next, [notHigher[0].id]).ok, false);
  }
  const higher = game.players[next].hand.find((c) => c.r > single[0].r && c.r !== 15);
  if (higher) {
    assert.ok(game.play(next, [higher.id]).ok);
  }
});

test('playing a 2 clears the trick and the same player leads again', () => {
  for (let rep = 0; rep < 30; rep++) {
    const game = new Game(4);
    const leader = game.turn;
    const two = game.players[leader].hand.find((c) => c.r === 15);
    const low = game.players[leader].hand.find((c) => c.r < 15);
    if (!two || !low) continue;
    // Lead a low single, next player answers with a 2: trick must clear and they lead.
    assert.ok(game.play(leader, [low.id]).ok);
    const responder = game.turn;
    const responderTwo = game.players[responder].hand.find((c) => c.r === 15);
    if (!responderTwo) continue;
    assert.ok(game.play(responder, [responderTwo.id]).ok);
    assert.strictEqual(game.trick.length, 0, 'trick cleared by the 2');
    assert.strictEqual(game.turn, responder, 'player of the 2 leads again');
    assert.ok(game.players.every((p) => !p.passed));
    return;
  }
  assert.fail('no deal produced the scenario in 30 tries');
});
