import assert from "node:assert/strict";
import test from "node:test";
import {
  beginAdventureAttempt,
  claimAdventureAttemptSettlement,
  createAdventureAttemptLifecycle,
  isAdventureAttemptTimedOut,
  startAdventureAttemptClock,
  type AdventureAttemptLifecycle
} from "../src/store/adventureAttempt.js";
import { useTypingCore } from "../src/store/typingCore.js";

test("Sprint retry stays idle until the new attempt receives printable input", () => {
  let lifecycle = beginAdventureAttempt(createAdventureAttemptLifecycle());
  const expiredAttemptId = lifecycle.attemptId;
  lifecycle = startAdventureAttemptClock(lifecycle, expiredAttemptId, 1_000, 37);
  assert.equal(isAdventureAttemptTimedOut(lifecycle, expiredAttemptId, 38_000), true);
  lifecycle = claimAdventureAttemptSettlement(lifecycle, expiredAttemptId).lifecycle;

  lifecycle = beginAdventureAttempt(lifecycle);
  assert.equal(lifecycle.deadlineMs, null);
  assert.equal(isAdventureAttemptTimedOut(lifecycle, lifecycle.attemptId, 500_000), false);
  assert.equal(claimAdventureAttemptSettlement(lifecycle, expiredAttemptId).claimed, false);
});

test("only the first printable character starts a retried Sprint clock", () => {
  useTypingCore.getState().reset("abc", "TOLERANT");
  useTypingCore.getState().commitCharacter("Backspace");
  useTypingCore.getState().commitCharacter("Shift");
  useTypingCore.getState().commitCharacter("ArrowLeft");
  assert.equal(useTypingCore.getState().startTime, null);

  let lifecycle = beginAdventureAttempt(createAdventureAttemptLifecycle());
  const attemptId = lifecycle.attemptId;
  useTypingCore.getState().commitCharacter("a");
  const startedAt = useTypingCore.getState().startTime;
  assert.notEqual(startedAt, null);

  lifecycle = startAdventureAttemptClock(lifecycle, attemptId, startedAt as number, 37);
  assert.equal(lifecycle.deadlineMs, (startedAt as number) + 37_000);

  const unchanged = startAdventureAttemptClock(lifecycle, attemptId, (startedAt as number) + 5_000, 37);
  assert.equal(unchanged, lifecycle);
});

test("a previous attempt timer cannot time out or settle a new attempt", () => {
  let lifecycle = beginAdventureAttempt(createAdventureAttemptLifecycle());
  const oldAttemptId = lifecycle.attemptId;
  lifecycle = startAdventureAttemptClock(lifecycle, oldAttemptId, 1_000, 37);

  lifecycle = beginAdventureAttempt(lifecycle);
  const newAttemptId = lifecycle.attemptId;
  assert.equal(isAdventureAttemptTimedOut(lifecycle, oldAttemptId, 100_000), false);
  assert.equal(claimAdventureAttemptSettlement(lifecycle, oldAttemptId).claimed, false);
  assert.equal(lifecycle.attemptId, newAttemptId);
  assert.equal(lifecycle.settled, false);
});

test("duplicate callbacks produce one progress report per attempt", () => {
  let lifecycle: AdventureAttemptLifecycle = beginAdventureAttempt(createAdventureAttemptLifecycle());
  let reportCount = 0;

  const report = (attemptId: number) => {
    const claim = claimAdventureAttemptSettlement(lifecycle, attemptId);
    lifecycle = claim.lifecycle;
    if (claim.claimed) reportCount += 1;
  };

  const firstAttemptId = lifecycle.attemptId;
  report(firstAttemptId);
  report(firstAttemptId);
  assert.equal(reportCount, 1);

  lifecycle = beginAdventureAttempt(lifecycle);
  const retryAttemptId = lifecycle.attemptId;
  report(firstAttemptId);
  report(firstAttemptId);
  assert.equal(reportCount, 1);

  report(retryAttemptId);
  report(retryAttemptId);
  assert.equal(reportCount, 2);
});
