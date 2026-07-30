export type AdventureChallengeType = "PRECISION" | "SPRINT" | "PERFECT_RUN";
export type AdventureInputMode = "STRICT" | "TOLERANT";

export interface AdventureThreshold {
  minAccuracy?: number;
  minWpm?: number;
  maxErrors?: number;
}

export interface AdventureConfig {
  schemaVersion: 1;
  challengeType: AdventureChallengeType;
  inputMode: AdventureInputMode;
  pass: AdventureThreshold;
  starThresholds: {
    two: AdventureThreshold;
    three: AdventureThreshold;
  };
  timeLimitSeconds?: number;
}

export interface AttemptMetrics {
  wpm: number;
  accuracy: number;
  errorCount: number;
  elapsedSeconds: number;
  inputMode: AdventureInputMode;
  completed: boolean;
  timedOut: boolean;
}

export type AdventureFailureReason =
  | "INPUT_MODE_MISMATCH"
  | "TIMED_OUT"
  | "FIRST_ERROR"
  | "INCOMPLETE"
  | "TOO_MANY_ERRORS"
  | "ACCURACY_TOO_LOW"
  | "WPM_TOO_LOW";

export interface AdventureEvaluation {
  passed: boolean;
  stars: number;
  failureReason: AdventureFailureReason | null;
  nextStarHint: string | null;
}

export const PRECISION_CONFIG: AdventureConfig = {
  schemaVersion: 1,
  challengeType: "PRECISION",
  inputMode: "STRICT",
  pass: { minAccuracy: 95 },
  starThresholds: {
    two: { minAccuracy: 98 },
    three: { minAccuracy: 100 }
  }
};

export const SPRINT_CONFIG: AdventureConfig = {
  schemaVersion: 1,
  challengeType: "SPRINT",
  inputMode: "TOLERANT",
  pass: { minAccuracy: 90, minWpm: 40 },
  starThresholds: {
    two: { minAccuracy: 92, minWpm: 50 },
    three: { minAccuracy: 95, minWpm: 60 }
  }
};

export const PERFECT_RUN_CONFIG: AdventureConfig = {
  schemaVersion: 1,
  challengeType: "PERFECT_RUN",
  inputMode: "STRICT",
  pass: { maxErrors: 0 },
  starThresholds: {
    two: { maxErrors: 0, minWpm: 40 },
    three: { maxErrors: 0, minWpm: 55 }
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFiniteNumber(value: unknown, label: string, minimum: number, maximum = Number.POSITIVE_INFINITY) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a finite number between ${minimum} and ${maximum}.`);
  }
  return value;
}

function parseThreshold(value: unknown, label: string): AdventureThreshold {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  const threshold: AdventureThreshold = {};
  if (value.minAccuracy !== undefined) threshold.minAccuracy = readFiniteNumber(value.minAccuracy, `${label}.minAccuracy`, 0, 100);
  if (value.minWpm !== undefined) threshold.minWpm = readFiniteNumber(value.minWpm, `${label}.minWpm`, 0);
  if (value.maxErrors !== undefined) threshold.maxErrors = readFiniteNumber(value.maxErrors, `${label}.maxErrors`, 0);
  if (Object.keys(threshold).length === 0) throw new Error(`${label} must contain at least one threshold.`);
  return threshold;
}

export function parseAdventureConfig(value: unknown): AdventureConfig {
  if (!isRecord(value)) throw new Error("Adventure config must be an object.");
  if (value.schemaVersion !== 1) throw new Error("Adventure config schemaVersion must be 1.");
  if (!(["PRECISION", "SPRINT", "PERFECT_RUN"] as unknown[]).includes(value.challengeType)) {
    throw new Error("Adventure config has an unsupported challengeType.");
  }
  if (value.inputMode !== "STRICT" && value.inputMode !== "TOLERANT") {
    throw new Error("Adventure config inputMode must be STRICT or TOLERANT.");
  }
  if (!isRecord(value.starThresholds)) throw new Error("Adventure config starThresholds must be an object.");

  const config: AdventureConfig = {
    schemaVersion: 1,
    challengeType: value.challengeType as AdventureChallengeType,
    inputMode: value.inputMode,
    pass: parseThreshold(value.pass, "adventure.pass"),
    starThresholds: {
      two: parseThreshold(value.starThresholds.two, "adventure.starThresholds.two"),
      three: parseThreshold(value.starThresholds.three, "adventure.starThresholds.three")
    }
  };
  if (value.timeLimitSeconds !== undefined) {
    config.timeLimitSeconds = readFiniteNumber(value.timeLimitSeconds, "adventure.timeLimitSeconds", 1);
  }
  if (config.challengeType === "PERFECT_RUN" && config.inputMode !== "STRICT") {
    throw new Error("PERFECT_RUN must use STRICT input mode.");
  }
  if (config.challengeType === "SPRINT" && config.pass.minWpm === undefined) {
    throw new Error("SPRINT pass threshold must define minWpm.");
  }
  return config;
}

function cloneConfig(config: AdventureConfig): AdventureConfig {
  return {
    ...config,
    pass: { ...config.pass },
    starThresholds: {
      two: { ...config.starThresholds.two },
      three: { ...config.starThresholds.three }
    }
  };
}

export function resolveAdventureConfig(metadata: unknown, textLength: number): AdventureConfig {
  const adventure = isRecord(metadata) ? metadata.adventure : undefined;
  const config = adventure === undefined ? cloneConfig(PRECISION_CONFIG) : parseAdventureConfig(adventure);
  if (config.challengeType === "SPRINT" && config.timeLimitSeconds === undefined) {
    const targetWpm = config.pass.minWpm as number;
    config.timeLimitSeconds = Math.max(1, Math.ceil((Math.max(1, textLength) / 5 / targetWpm) * 60));
  }
  return config;
}

function meetsThreshold(threshold: AdventureThreshold, metrics: AttemptMetrics) {
  if (threshold.minAccuracy !== undefined && metrics.accuracy < threshold.minAccuracy) return false;
  if (threshold.minWpm !== undefined && metrics.wpm < threshold.minWpm) return false;
  if (threshold.maxErrors !== undefined && metrics.errorCount > threshold.maxErrors) return false;
  return true;
}

function thresholdHint(threshold: AdventureThreshold, stars: number) {
  const requirements: string[] = [];
  if (threshold.minAccuracy !== undefined) requirements.push(`${threshold.minAccuracy}% accuracy`);
  if (threshold.minWpm !== undefined) requirements.push(`${threshold.minWpm} WPM`);
  if (threshold.maxErrors !== undefined) requirements.push(`at most ${threshold.maxErrors} errors`);
  return `Reach ${requirements.join(" and ")} for ${stars} ${stars === 1 ? "star" : "stars"}.`;
}

function failureReason(config: AdventureConfig, metrics: AttemptMetrics): AdventureFailureReason | null {
  if (metrics.inputMode !== config.inputMode) return "INPUT_MODE_MISMATCH";
  if (
    config.challengeType === "SPRINT" &&
    (metrics.timedOut || (config.timeLimitSeconds !== undefined && metrics.elapsedSeconds > config.timeLimitSeconds))
  ) {
    return "TIMED_OUT";
  }
  if (config.challengeType === "PERFECT_RUN" && metrics.errorCount > 0) return "FIRST_ERROR";
  if (!metrics.completed) return "INCOMPLETE";
  if (config.pass.maxErrors !== undefined && metrics.errorCount > config.pass.maxErrors) return "TOO_MANY_ERRORS";
  if (config.pass.minAccuracy !== undefined && metrics.accuracy < config.pass.minAccuracy) return "ACCURACY_TOO_LOW";
  if (config.pass.minWpm !== undefined && metrics.wpm < config.pass.minWpm) return "WPM_TOO_LOW";
  return null;
}

export function evaluateAdventureAttempt(config: AdventureConfig, metrics: AttemptMetrics): AdventureEvaluation {
  const reason = failureReason(config, metrics);
  if (reason) {
    return {
      passed: false,
      stars: 0,
      failureReason: reason,
      nextStarHint:
        reason === "TIMED_OUT" && config.timeLimitSeconds !== undefined
          ? `Complete within ${config.timeLimitSeconds} seconds.`
          : thresholdHint(config.pass, 1)
    };
  }

  const stars = meetsThreshold(config.starThresholds.three, metrics)
    ? 3
    : meetsThreshold(config.starThresholds.two, metrics)
      ? 2
      : 1;
  const nextThreshold = stars === 1 ? config.starThresholds.two : stars === 2 ? config.starThresholds.three : null;
  return {
    passed: true,
    stars,
    failureReason: null,
    nextStarHint: nextThreshold ? thresholdHint(nextThreshold, stars + 1) : null
  };
}

export function challengeSummary(config: AdventureConfig) {
  if (config.challengeType === "PRECISION") return `Precision / ${config.pass.minAccuracy}%+`;
  if (config.challengeType === "SPRINT") return `Sprint / ${config.pass.minWpm} WPM`;
  return "Perfect Run / 0 errors";
}
