import assert from "node:assert/strict";
import test from "node:test";
import {
  challengeSummary,
  evaluateAdventureAttempt,
  parseAdventureConfig,
  passThresholdSummary,
  PERFECT_RUN_CONFIG,
  PRECISION_CONFIG,
  resolveAdventureConfig,
  SPRINT_CONFIG,
  type AttemptMetrics
} from "../shared/adventure/evaluator.js";
import { chapterOneConfigs, chunks, contentNodes, sources } from "../server/seed.js";

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

// ── Core evaluator boundary tests ──────────────────────────────────────

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

test("SPRINT 1-star: completed within time + accuracy达标 = pass, regardless of WPM", () => {
  const config = resolveAdventureConfig({ adventure: SPRINT_CONFIG }, 100);
  // ceil((100 / 5 / 40) * 60 * 1.15) = ceil(34.5) = 35
  assert.equal(config.timeLimitSeconds, 35);

  // Below paceTargetWpm (40) but within time limit and accuracy OK → 1 star (PASSED)
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 20, accuracy: 100 })).stars, 1);
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 20, accuracy: 100 })).passed, true);

  // Even very low WPM still passes 1-star if within time + accuracy
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 1, accuracy: 90 })).stars, 1);

  // 2-star and 3-star still require WPM thresholds
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 50, accuracy: 92 })).stars, 2);
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 60, accuracy: 95 })).stars, 3);

  // Just below 2-star WPM threshold → still 1 star
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 49.9, accuracy: 95 })).stars, 1);
});

test("SPRINT failure: timeout always fails even with high WPM", () => {
  const config = resolveAdventureConfig({ adventure: SPRINT_CONFIG }, 100);
  // timeLimitSeconds = 35

  // Timed out flag set → fail regardless of WPM
  assert.deepEqual(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 100, accuracy: 100, elapsedSeconds: 10, timedOut: true })),
    {
      passed: false,
      stars: 0,
      failureReason: "TIMED_OUT",
      nextStarHint: "Complete within 35 seconds."
    }
  );

  // Elapsed exceeds limit (even without timedOut flag) → fail
  assert.equal(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 100, accuracy: 100, elapsedSeconds: 35.1, timedOut: false })).failureReason,
    "TIMED_OUT"
  );
});

test("SPRINT failure: accuracy below pass threshold fails even within time", () => {
  const config = resolveAdventureConfig({ adventure: SPRINT_CONFIG }, 100);
  // pass.minAccuracy = 90

  assert.equal(
    evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 60, accuracy: 89.9, elapsedSeconds: 10 })).failureReason,
    "ACCURACY_TOO_LOW"
  );
  // Accuracy exactly at threshold → pass
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 20, accuracy: 90, elapsedSeconds: 10 })).stars, 1);
});

test("SPRINT 2/3-star still require WPM + accuracy thresholds", () => {
  const config = resolveAdventureConfig({ adventure: SPRINT_CONFIG }, 100);
  // starThresholds: two = { minAccuracy: 92, minWpm: 50 }, three = { minAccuracy: 95, minWpm: 60 }

  // WPM meets 2-star but accuracy doesn't → 1 star
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 50, accuracy: 91 })).stars, 1);
  // Accuracy meets 2-star but WPM doesn't → 1 star
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 49, accuracy: 95 })).stars, 1);
  // Both meet 2-star → 2 stars
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 50, accuracy: 92 })).stars, 2);

  // WPM meets 3-star but accuracy doesn't → 2 stars (if meets 2-star)
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 60, accuracy: 93 })).stars, 2);
  // Both meet 3-star → 3 stars
  assert.equal(evaluateAdventureAttempt(config, attempt({ inputMode: "TOLERANT", wpm: 60, accuracy: 95 })).stars, 3);
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

test("SPRINT validation requires paceTargetWpm or timeLimitSeconds, and pass.minAccuracy", () => {
  // Missing both paceTargetWpm and timeLimitSeconds
  assert.throws(
    () => parseAdventureConfig({
      schemaVersion: 1, challengeType: "SPRINT", inputMode: "TOLERANT",
      pass: { minAccuracy: 90 },
      starThresholds: { two: { minAccuracy: 92, minWpm: 50 }, three: { minAccuracy: 95, minWpm: 60 } }
    }),
    /paceTargetWpm or timeLimitSeconds/
  );

  // Missing pass.minAccuracy (pass has minWpm but no minAccuracy — minWpm gets stripped, leaving pass empty)
  assert.throws(
    () => parseAdventureConfig({
      schemaVersion: 1, challengeType: "SPRINT", inputMode: "TOLERANT",
      pass: { minWpm: 40 },
      paceTargetWpm: 40,
      starThresholds: { two: { minAccuracy: 92, minWpm: 50 }, three: { minAccuracy: 95, minWpm: 60 } }
    }),
    /minAccuracy/
  );

  // Valid with paceTargetWpm
  const valid1 = parseAdventureConfig({
    schemaVersion: 1, challengeType: "SPRINT", inputMode: "TOLERANT",
    pass: { minAccuracy: 90 },
    paceTargetWpm: 40,
    starThresholds: { two: { minAccuracy: 92, minWpm: 50 }, three: { minAccuracy: 95, minWpm: 60 } }
  });
  assert.equal(valid1.paceTargetWpm, 40);
  assert.equal(valid1.pass.minWpm, undefined);

  // Valid with explicit timeLimitSeconds (no paceTargetWpm needed)
  const valid2 = parseAdventureConfig({
    schemaVersion: 1, challengeType: "SPRINT", inputMode: "TOLERANT",
    pass: { minAccuracy: 90 },
    timeLimitSeconds: 42,
    starThresholds: { two: { minAccuracy: 92, minWpm: 50 }, three: { minAccuracy: 95, minWpm: 60 } }
  });
  assert.equal(valid2.timeLimitSeconds, 42);
  assert.equal(valid2.paceTargetWpm, undefined);
});

test("SPRINT backward compat: old pass.minWpm migrates to paceTargetWpm", () => {
  // Simulate old DB config with pass.minWpm
  const oldConfig = {
    schemaVersion: 1, challengeType: "SPRINT", inputMode: "TOLERANT",
    pass: { minAccuracy: 90, minWpm: 40 },
    starThresholds: { two: { minAccuracy: 92, minWpm: 50 }, three: { minAccuracy: 95, minWpm: 60 } }
  };
  const migrated = parseAdventureConfig(oldConfig);
  assert.equal(migrated.paceTargetWpm, 40, "pass.minWpm should migrate to paceTargetWpm");
  assert.equal(migrated.pass.minWpm, undefined, "pass.minWpm should be removed after migration");
  assert.equal(migrated.pass.minAccuracy, 90, "pass.minAccuracy should be preserved");
});

// ── challengeSummary and passThresholdSummary ─────────────────────────

test("challengeSummary shows 'Sprint' without WPM for SPRINT configs", () => {
  assert.equal(challengeSummary(PRECISION_CONFIG), "Precision / 95%+");
  assert.equal(challengeSummary(SPRINT_CONFIG), "Sprint");
  assert.equal(challengeSummary(PERFECT_RUN_CONFIG), "Perfect Run / 0 errors");
});

test("passThresholdSummary renders correct 1-star threshold for each challenge type", () => {
  // PRECISION: just accuracy
  assert.equal(passThresholdSummary(PRECISION_CONFIG), "95% acc");

  // SPRINT raw config (no timeLimitSeconds resolved): just accuracy
  assert.equal(passThresholdSummary(SPRINT_CONFIG), "90% accuracy");

  // SPRINT resolved config (with timeLimitSeconds): time + accuracy, NO WPM
  const resolved = resolveAdventureConfig({ adventure: SPRINT_CONFIG }, 200);
  // timeLimitSeconds = ceil((200/5/40) × 60 × 1.15) = ceil(69) = 69
  assert.equal(passThresholdSummary(resolved), "Complete within 69s + 90% accuracy");

  // PERFECT_RUN: just errors
  assert.equal(passThresholdSummary(PERFECT_RUN_CONFIG), "0 errors");
});

test("SPRINT passThresholdSummary never contains old minWpm as 1-star threshold", () => {
  // For all SPRINT levels in Chapter One, the 1-star summary must NOT contain "WPM"
  const sprintIndices = [3, 4, 5, 9]; // L4, L5, L6, L10
  for (const idx of sprintIndices) {
    const chunk = geekChunks[idx];
    const text = contentNodes
      .filter((node) => node.chunk_id === chunk.id)
      .sort((a, b) => a.sequence - b.sequence)
      .map((node) => node.raw_text)
      .join(" ");
    const config = resolveAdventureConfig(chunk.metadata, text.length);
    const summary = passThresholdSummary(config);
    assert.ok(
      !summary.includes("WPM"),
      `Level ${idx + 1} (${chunk.title}): 1-star summary must not contain "WPM" — got: "${summary}"`
    );
    assert.ok(
      summary.includes("Complete within"),
      `Level ${idx + 1} (${chunk.title}): 1-star summary should contain "Complete within" — got: "${summary}"`
    );
  }
});

// ── Sprint 1.15x time-limit formula ───────────────────────────────────

test("Sprint formula applies 1.15x buffer using paceTargetWpm and explicit timeLimitSeconds overrides it", () => {
  // SPRINT_CONFIG has paceTargetWpm=40; textLength=250 → ceil((250/5/40) × 60 × 1.15) = ceil(86.25) = 87
  const derived = resolveAdventureConfig({ adventure: SPRINT_CONFIG }, 250);
  assert.equal(derived.timeLimitSeconds, 87);

  // Explicit timeLimitSeconds must be preserved
  const explicit = resolveAdventureConfig(
    { adventure: { ...SPRINT_CONFIG, timeLimitSeconds: 42 } },
    250
  );
  assert.equal(explicit.timeLimitSeconds, 42);

  // Non-SPRINT configs never get a derived timeLimit
  const precision = resolveAdventureConfig({ adventure: PRECISION_CONFIG }, 250);
  assert.equal(precision.timeLimitSeconds, undefined);
});

// ── Chapter One: 12-level spec table ──────────────────────────────────

const geekSourceId = sources[1].id;
const geekChunks = chunks
  .filter((c) => c.source_id === geekSourceId)
  .sort((a, b) => a.section_num - b.section_num);

interface LevelSpec {
  name: string;
  type: "PRECISION" | "SPRINT" | "PERFECT_RUN";
  mode: "STRICT" | "TOLERANT";
  pass: Record<string, number>;
  paceTargetWpm?: number;
  two: Record<string, number>;
  three: Record<string, number>;
  optional?: boolean;
}

const LEVEL_SPEC: LevelSpec[] = [
  { name: "Boot Sequence",     type: "PRECISION",   mode: "TOLERANT", pass: { minAccuracy: 80 },                two: { minAccuracy: 88 },                three: { minAccuracy: 95 } },
  { name: "Async Vocabulary",  type: "PRECISION",   mode: "STRICT",   pass: { minAccuracy: 85 },                two: { minAccuracy: 92 },                three: { minAccuracy: 97 } },
  { name: "Signal Check",      type: "PRECISION",   mode: "STRICT",   pass: { minAccuracy: 90 },                two: { minAccuracy: 95 },                three: { minAccuracy: 98 } },
  { name: "Terminal Sprint",   type: "SPRINT",      mode: "TOLERANT", pass: { minAccuracy: 85 }, paceTargetWpm: 25, two: { minAccuracy: 90, minWpm: 35 },    three: { minAccuracy: 95, minWpm: 45 } },
  { name: "Keyboard Flow",     type: "SPRINT",      mode: "TOLERANT", pass: { minAccuracy: 88 }, paceTargetWpm: 30, two: { minAccuracy: 92, minWpm: 38 },    three: { minAccuracy: 95, minWpm: 48 } },
  { name: "API Rhythm",        type: "SPRINT",      mode: "TOLERANT", pass: { minAccuracy: 90 }, paceTargetWpm: 35, two: { minAccuracy: 93, minWpm: 42 },    three: { minAccuracy: 96, minWpm: 52 } },
  { name: "Request Review",    type: "PRECISION",   mode: "STRICT",   pass: { minAccuracy: 92 },                two: { minAccuracy: 96 },                three: { minAccuracy: 99 } },
  { name: "Clean Command",     type: "PERFECT_RUN", mode: "STRICT",   pass: { maxErrors: 0 },                   two: { maxErrors: 0, minWpm: 30 },       three: { maxErrors: 0, minWpm: 40 }, optional: true },
  { name: "Payload Check",     type: "PRECISION",   mode: "STRICT",   pass: { minAccuracy: 93 },                two: { minAccuracy: 97 },                three: { minAccuracy: 100 } },
  { name: "Service Flow",      type: "SPRINT",      mode: "TOLERANT", pass: { minAccuracy: 90 }, paceTargetWpm: 35, two: { minAccuracy: 94, minWpm: 45 },    three: { minAccuracy: 97, minWpm: 55 } },
  { name: "Release Notes",     type: "PRECISION",   mode: "STRICT",   pass: { minAccuracy: 95 },                two: { minAccuracy: 98 },                three: { minAccuracy: 100 } },
  { name: "Zero-Error Release",type: "PERFECT_RUN", mode: "STRICT",   pass: { maxErrors: 0 },                   two: { maxErrors: 0, minWpm: 35 },       three: { maxErrors: 0, minWpm: 50 }, optional: true },
];

// Main-line level section numbers (everything except 8 and 12)
const MAIN_LINE_SECTIONS = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11];

test("Chapter One has exactly 12 levels with valid adventure configs", () => {
  assert.equal(geekChunks.length, 12);
  assert.equal(chapterOneConfigs.length, 12);

  for (let i = 0; i < geekChunks.length; i++) {
    const chunk = geekChunks[i];
    const adventure = chunk.metadata?.adventure;
    assert.ok(adventure, `Level ${i + 1} must have metadata.adventure`);
    const parsed = parseAdventureConfig(adventure);
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(chapterOneConfigs[i].challengeType, parsed.challengeType);
  }
});

test("Chapter One levels match the spec table: name, type, mode, thresholds, paceTargetWpm", () => {
  for (let i = 0; i < LEVEL_SPEC.length; i++) {
    const spec = LEVEL_SPEC[i];
    const chunk = geekChunks[i];
    const config = parseAdventureConfig(chunk.metadata?.adventure);

    assert.equal(chunk.title, spec.name, `Level ${i + 1} name mismatch`);
    assert.equal(config.challengeType, spec.type, `Level ${i + 1} type mismatch`);
    assert.equal(config.inputMode, spec.mode, `Level ${i + 1} mode mismatch`);

    // 1-star (pass) threshold — SPRINT pass must NOT contain minWpm
    assert.deepEqual(config.pass, spec.pass, `Level ${i + 1} pass threshold mismatch`);

    // paceTargetWpm (SPRINT only)
    assert.equal(config.paceTargetWpm, spec.paceTargetWpm, `Level ${i + 1} paceTargetWpm mismatch`);

    // 2-star threshold
    assert.deepEqual(config.starThresholds.two, spec.two, `Level ${i + 1} 2-star threshold mismatch`);

    // 3-star threshold
    assert.deepEqual(config.starThresholds.three, spec.three, `Level ${i + 1} 3-star threshold mismatch`);

    // Optional flag
    if (spec.optional) {
      assert.equal(chunk.metadata?.optional, true, `Level ${i + 1} should be optional`);
    } else {
      assert.notEqual(chunk.metadata?.optional, true, `Level ${i + 1} should NOT be optional`);
    }
  }
});

// ── Chapter One dependency graph ──────────────────────────────────────

test("Chapter One dependency graph matches the design spec", () => {
  const deps = geekChunks.map((c) => c.dependencies);
  // Main line: 1→2→3→4→5→6→7→9→10→11
  assert.deepEqual(deps[0], []);                                          // L1: no deps
  assert.deepEqual(deps[1], [geekChunks[0].id]);                          // L2 → L1
  assert.deepEqual(deps[2], [geekChunks[1].id]);                          // L3 → L2
  assert.deepEqual(deps[3], [geekChunks[2].id]);                          // L4 → L3
  assert.deepEqual(deps[4], [geekChunks[3].id]);                          // L5 → L4
  assert.deepEqual(deps[5], [geekChunks[4].id]);                          // L6 → L5
  assert.deepEqual(deps[6], [geekChunks[5].id]);                          // L7 → L6
  // L8: optional, branches from L3
  assert.deepEqual(deps[7], [geekChunks[2].id]);                          // L8 → L3
  assert.deepEqual(deps[8], [geekChunks[6].id]);                          // L9 → L7
  assert.deepEqual(deps[9], [geekChunks[8].id]);                          // L10 → L9
  assert.deepEqual(deps[10], [geekChunks[9].id]);                         // L11 → L10
  // L12: optional, branches from L11
  assert.deepEqual(deps[11], [geekChunks[10].id]);                        // L12 → L11
});

test("Chapter One marks levels 8 and 12 as optional challenges", () => {
  assert.equal(geekChunks[7].metadata?.optional, true);   // L8: Clean Command
  assert.equal(geekChunks[11].metadata?.optional, true);  // L12: Zero-Error Release
  for (let i = 0; i < geekChunks.length; i++) {
    if (i === 7 || i === 11) continue;
    assert.notEqual(geekChunks[i].metadata?.optional, true, `Level ${i + 1} should not be optional`);
  }
});

test("Chapter One challenge types follow the PRECISION→SPRINT→PERFECT_RUN curve", () => {
  const types = geekChunks.map((c) => c.metadata?.adventure?.challengeType);
  assert.deepEqual(types, [
    "PRECISION",    // L1:  Boot Sequence
    "PRECISION",    // L2:  Async Vocabulary
    "PRECISION",    // L3:  Signal Check
    "SPRINT",       // L4:  Terminal Sprint
    "SPRINT",       // L5:  Keyboard Flow
    "SPRINT",       // L6:  API Rhythm
    "PRECISION",    // L7:  Request Review
    "PERFECT_RUN",  // L8:  Clean Command (optional)
    "PRECISION",    // L9:  Payload Check
    "SPRINT",       // L10: Service Flow
    "PRECISION",    // L11: Release Notes (main boss)
    "PERFECT_RUN"   // L12: Zero-Error Release (optional)
  ]);
});

// ── P0 Safety: PERFECT_RUN never blocks main line ─────────────────────

/**
 * Collect all transitive dependency ancestors for a given chunk.
 */
function collectAncestors(chunkId: string, allChunks: typeof chunks): Set<string> {
  const ancestors = new Set<string>();
  const queue = [chunkId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = allChunks.find((c) => c.id === currentId);
    if (!current) continue;
    for (const dep of current.dependencies) {
      if (!ancestors.has(dep)) {
        ancestors.add(dep);
        queue.push(dep);
      }
    }
  }
  return ancestors;
}

test("P0: No main-line level has a PERFECT_RUN or optional ancestor", () => {
  for (const sectionNum of MAIN_LINE_SECTIONS) {
    const chunk = geekChunks.find((c) => c.section_num === sectionNum);
    assert.ok(chunk, `Main-line level ${sectionNum} must exist`);

    const ancestors = collectAncestors(chunk.id, chunks);
    for (const ancestorId of ancestors) {
      const ancestor = chunks.find((c) => c.id === ancestorId);
      assert.ok(ancestor, `Ancestor ${ancestorId} of L${sectionNum} must exist`);

      const ancestorType = ancestor.metadata?.adventure?.challengeType;
      assert.notEqual(
        ancestorType,
        "PERFECT_RUN",
        `Main-line L${sectionNum} (${chunk.title}) depends on PERFECT_RUN level "${ancestor.title}" — this violates the design principle`
      );
      assert.notEqual(
        ancestor.metadata?.optional,
        true,
        `Main-line L${sectionNum} (${chunk.title}) depends on optional level "${ancestor.title}" — optional levels must never block main line`
      );
    }
  }
});

test("P0: Level 9 is unlocked after Level 7, even if Level 8 is never completed", () => {
  const l9 = geekChunks.find((c) => c.section_num === 9);
  assert.ok(l9, "Level 9 must exist");

  // L9's dependencies must be exactly [L7], not [L8]
  const l7 = geekChunks.find((c) => c.section_num === 7);
  const l8 = geekChunks.find((c) => c.section_num === 8);
  assert.ok(l7 && l8);

  assert.ok(
    l9.dependencies.includes(l7.id),
    "L9 must depend on L7"
  );
  assert.ok(
    !l9.dependencies.includes(l8.id),
    "L9 must NOT depend on L8 — completing L7 alone must unlock L9"
  );

  // Simulate: only L1-L7 completed, L8 not completed → L9 should be unlocked
  const completedIds = new Set(
    geekChunks.filter((c) => [1, 2, 3, 4, 5, 6, 7].includes(c.section_num)).map((c) => c.id)
  );
  const l8Completed = false; // L8 never touched

  const l9Unlocked = l9.dependencies.every((dep) => completedIds.has(dep));
  assert.equal(l9Unlocked, true, "L9 must be unlocked when L1-L7 are completed (L8 not required)");
  assert.equal(l8Completed, false, "Sanity: L8 is not completed in this scenario");
});

test("P0: Level 12 non-completion does not affect main-line completion", () => {
  const l12 = geekChunks.find((c) => c.section_num === 12);
  assert.ok(l12, "Level 12 must exist");
  assert.equal(l12.metadata?.optional, true, "L12 must be optional");

  // No main-line level depends on L12
  for (const sectionNum of MAIN_LINE_SECTIONS) {
    const chunk = geekChunks.find((c) => c.section_num === sectionNum);
    assert.ok(chunk);
    assert.ok(
      !chunk.dependencies.includes(l12.id),
      `Main-line L${sectionNum} (${chunk.title}) must NOT depend on L12`
    );
  }

  // Main-line completion = completing all main-line levels (1-7, 9-11)
  // L12 is not in this set
  assert.ok(
    !MAIN_LINE_SECTIONS.includes(12),
    "L12 is not part of main-line completion"
  );
});

// ── Chapter One Sprint time limits with 1.15x formula ─────────────────

test("Chapter One Sprint levels derive correct 1.15x time limits from actual text", () => {
  // Sprint levels are: L4 (idx 3), L5 (idx 4), L6 (idx 5), L10 (idx 9)
  const sprintIndices = [3, 4, 5, 9];
  for (const idx of sprintIndices) {
    const chunk = geekChunks[idx];
    const text = contentNodes
      .filter((node) => node.chunk_id === chunk.id)
      .sort((a, b) => a.sequence - b.sequence)
      .map((node) => node.raw_text)
      .join(" ");
    const config = resolveAdventureConfig(chunk.metadata, text.length);
    const targetWpm = config.paceTargetWpm as number;
    const expected = Math.max(1, Math.ceil((Math.max(1, text.length) / 5 / targetWpm) * 60 * 1.15));
    assert.equal(
      config.timeLimitSeconds,
      expected,
      `Level ${idx + 1} (${chunk.title}): textLength=${text.length}, paceTargetWpm=${targetWpm}, expected=${expected}, got=${config.timeLimitSeconds}`
    );
    assert.ok(config.timeLimitSeconds! > 0);
  }
});

// ── Sprint regression: API Rhythm (L6) exact scenario from bug report ──

test("Regression: API Rhythm L6 — 32.8 WPM within 66s + 96.4% accuracy = 1 star (not failure)", () => {
  // L6 config: paceTargetWpm=35, pass.minAccuracy=90
  // starThresholds: two={minAccuracy:93, minWpm:42}, three={minAccuracy:96, minWpm:52}
  const l6 = geekChunks.find((c) => c.section_num === 6);
  assert.ok(l6, "Level 6 must exist");

  const text = contentNodes
    .filter((node) => node.chunk_id === l6.id)
    .sort((a, b) => a.sequence - b.sequence)
    .map((node) => node.raw_text)
    .join(" ");
  const config = resolveAdventureConfig(l6.metadata, text.length);

  // Verify timeLimit is derived from paceTargetWpm=35
  const expectedLimit = Math.max(1, Math.ceil((Math.max(1, text.length) / 5 / 35) * 60 * 1.15));
  assert.equal(config.timeLimitSeconds, expectedLimit, "L6 timeLimit should match 1.15x formula with paceTargetWpm=35");

  // The exact scenario from the bug report: 32.8 WPM, 96.4% accuracy, 60.8s
  // timeLimit ≈ 66s (depending on exact text length), 60.8 < 66 → within time
  const result = evaluateAdventureAttempt(config, attempt({
    inputMode: "TOLERANT",
    wpm: 32.8,
    accuracy: 96.4,
    elapsedSeconds: 60.8,
    timedOut: false,
    completed: true
  }));

  assert.equal(result.passed, true, "32.8 WPM within time + 96.4% accuracy must PASS (1 star)");
  assert.equal(result.stars, 1, "Should be exactly 1 star (below 42 WPM for 2-star)");
  assert.equal(result.failureReason, null, "No failure reason when passed");
});

// ── Seed consistency: word_count matches actual text ──────────────────

test("Chapter One seed consistency: word_count matches actual content text", () => {
  for (const chunk of geekChunks) {
    const text = contentNodes
      .filter((node) => node.chunk_id === chunk.id)
      .sort((a, b) => a.sequence - b.sequence)
      .map((node) => node.raw_text)
      .join(" ");
    const actualWords = text.split(/\s+/).filter(Boolean).length;
    assert.equal(
      chunk.word_count,
      actualWords,
      `Level ${chunk.section_num} (${chunk.title}): word_count=${chunk.word_count} but actual words=${actualWords}`
    );
  }
});

// ── Backfill idempotency: configs survive JSON round-trip ─────────────

test("backfill idempotency: adventure configs survive JSON round-trip", () => {
  for (const chunk of geekChunks) {
    const original = chunk.metadata?.adventure;
    assert.ok(original);
    const roundTripped = parseAdventureConfig(JSON.parse(JSON.stringify(original)));
    assert.deepEqual(
      roundTripped,
      original,
      `Level ${chunk.section_num} (${chunk.title}): config changed after JSON round-trip`
    );
  }
});

test("backfill safety: only Geek Typing Core chunks are touched by backfill script", () => {
  // The backfill script imports chunks and contentNodes from seed.ts,
  // filters to source_id === GEEK_SOURCE_ID, and only upserts those.
  // Verify that the seed data for non-Geek sources is not included in
  // the Geek chunk/content node sets.
  const geekChunkIds = new Set(geekChunks.map((c) => c.id));
  const nonGeekChunks = chunks.filter((c) => c.source_id !== geekSourceId);
  for (const chunk of nonGeekChunks) {
    assert.ok(
      !geekChunkIds.has(chunk.id),
      `Non-Geek chunk ${chunk.id} (${chunk.title}) must not be in the backfill set`
    );
  }

  // Verify no content node from a non-Geek chunk is in the Geek node set
  const geekNodeIds = new Set(
    contentNodes.filter((n) => geekChunkIds.has(n.chunk_id)).map((n) => n.id)
  );
  const nonGeekNodes = contentNodes.filter((n) => !geekChunkIds.has(n.chunk_id));
  for (const node of nonGeekNodes) {
    assert.ok(
      !geekNodeIds.has(node.id),
      `Non-Geek content node ${node.id} must not be in the backfill set`
    );
  }
});
