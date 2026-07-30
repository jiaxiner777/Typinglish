import assert from "node:assert/strict";
import test from "node:test";
import {
  challengeSummary,
  evaluateAdventureAttempt,
  parseAdventureConfig,
  PERFECT_RUN_CONFIG,
  PRECISION_CONFIG,
  resolveAdventureConfig,
  SPRINT_CONFIG,
  type AttemptMetrics
} from "../shared/adventure/evaluator.js";
import { chunks, contentNodes, DEMO_LEVEL_2_SPRINT_CONFIG } from "../server/seed.js";

function attempt(patch: Partial<AttemptMetrics> = {}): AttemptMetrics {
  return {
    wpm: 60,
    accuracy: 100,
    errorCount: 0,
    elapsedSeconds: 20,
    inputMode: "STRICT",
    completed: true,
    timedOut: false,
    ...patch
  };
}

test("PRECISION evaluates 0/1/2/3-star accuracy boundaries", () => {
  assert.deepEqual(evaluateAdventureAttempt(PRECISION_CONFIG, attempt({ accuracy: 94.9 })), {
    passed: false,
    stars: 0,
    failureReason: "ACCURACY_TOO_LOW",
    nextStarHint: "Reach 95% accuracy for 1 star."
  });
  assert.equal(evaluateAdventureAttempt(PRECISION_CONFIG, attempt({ accuracy: 95 })).stars, 1);
  assert.equal(evaluateAdventureAttempt(PRECISION_CONFIG, attempt({ accuracy: 98 })).stars, 2);
  assert.equal(evaluateAdventureAttempt(PRECISION_CONFIG, attempt({ accuracy: 100 })).stars, 3);
});

test("SPRINT evaluates speed, accuracy, and timeout boundaries", () => {
  const config = resolveAdventureConfig({ adventure: SPRINT_CONFIG }, 100);
  assert.equal(config.timeLimitSeconds, 30);
  assert.equal(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 39.9, accuracy: 100 })).failureReason,
    "WPM_TOO_LOW"
  );
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 40, accuracy: 90 })).stars, 1);
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 50, accuracy: 92 })).stars, 2);
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 60, accuracy: 95 })).stars, 3);
  assert.deepEqual(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", elapsedSeconds: 30.1, timedOut: false })),
    {
      passed: false,
      stars: 0,
      failureReason: "TIMED_OUT",
      nextStarHint: "Complete within 30 seconds."
    }
  );
  assert.equal(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", elapsedSeconds: 10, timedOut: true })).failureReason,
    "TIMED_OUT"
  );
});

test("demo Level 2 Sprint uses accessible 0/1/2/3-star boundaries and a derived time limit", () => {
  const chunk = chunks.find((item) => item.title === "Terminal Sprint");
  assert.ok(chunk);
  const text = contentNodes
    .filter((node) => node.chunk_id === chunk.id)
    .sort((left, right) => left.sequence - right.sequence)
    .map((node) => node.raw_text)
    .join(" ");
  const config = resolveAdventureConfig(chunk.metadata, text.length);

  assert.deepEqual(chunk.metadata?.adventure, DEMO_LEVEL_2_SPRINT_CONFIG);
  assert.equal(text.length, 123);
  assert.equal(config.timeLimitSeconds, 60);
  assert.equal(challengeSummary(config), "Sprint / 25 WPM");
  assert.equal(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 25, accuracy: 84.9 })).failureReason,
    "ACCURACY_TOO_LOW"
  );
  assert.equal(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 24.9, accuracy: 100 })).failureReason,
    "WPM_TOO_LOW"
  );
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 25, accuracy: 85 })).stars, 1);
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 35, accuracy: 90 })).stars, 2);
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 45, accuracy: 95 })).stars, 3);
  assert.equal(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 32.4, accuracy: 88, errorCount: 12 })).stars,
    1
  );
  assert.equal(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", elapsedSeconds: 60.1 })).failureReason,
    "TIMED_OUT"
  );
});

test("PERFECT_RUN ends on the first error and evaluates speed stars", () => {
  assert.equal(
    evaluateAdventureAttempt(PERFECT_RUN_CONFIG, attempt({ completed: false, errorCount: 1 })).failureReason,
    "FIRST_ERROR"
  );
  assert.equal(evaluateAdventureAttempt(PERFECT_RUN_CONFIG, attempt({ wpm: 39.9 })).stars, 1);
  assert.equal(evaluateAdventureAttempt(PERFECT_RUN_CONFIG, attempt({ wpm: 40 })).stars, 2);
  assert.equal(evaluateAdventureAttempt(PERFECT_RUN_CONFIG, attempt({ wpm: 55 })).stars, 3);
});

test("runtime validation rejects invalid and non-strict PERFECT_RUN configs", () => {
  assert.throws(() => parseAdventureConfig({}), /schemaVersion/);
  assert.throws(
    () => parseAdventureConfig({ ...PERFECT_RUN_CONFIG, inputMode: "TOLERANT" }),
    /must use STRICT/
  );
});
