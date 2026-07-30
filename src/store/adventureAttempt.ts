export interface AdventureAttemptLifecycle {
  attemptId: number;
  deadlineMs: number | null;
  settled: boolean;
}

export interface AdventureAttemptSettlementClaim {
  lifecycle: AdventureAttemptLifecycle;
  claimed: boolean;
}

export function createAdventureAttemptLifecycle(): AdventureAttemptLifecycle {
  return { attemptId: 0, deadlineMs: null, settled: false };
}

export function beginAdventureAttempt(previous: AdventureAttemptLifecycle): AdventureAttemptLifecycle {
  return {
    attemptId: previous.attemptId + 1,
    deadlineMs: null,
    settled: false
  };
}

export function startAdventureAttemptClock(
  lifecycle: AdventureAttemptLifecycle,
  expectedAttemptId: number,
  startedAtMs: number,
  limitSeconds: number
): AdventureAttemptLifecycle {
  if (
    lifecycle.attemptId !== expectedAttemptId ||
    lifecycle.settled ||
    lifecycle.deadlineMs !== null
  ) {
    return lifecycle;
  }

  return {
    ...lifecycle,
    deadlineMs: startedAtMs + limitSeconds * 1000
  };
}

export function getAdventureAttemptRemainingSeconds(
  lifecycle: AdventureAttemptLifecycle,
  expectedAttemptId: number,
  nowMs: number
): number | null {
  if (
    lifecycle.attemptId !== expectedAttemptId ||
    lifecycle.settled ||
    lifecycle.deadlineMs === null
  ) {
    return null;
  }

  return Math.max(0, (lifecycle.deadlineMs - nowMs) / 1000);
}

export function isAdventureAttemptTimedOut(
  lifecycle: AdventureAttemptLifecycle,
  expectedAttemptId: number,
  nowMs: number
): boolean {
  const remaining = getAdventureAttemptRemainingSeconds(lifecycle, expectedAttemptId, nowMs);
  return remaining !== null && remaining <= 0;
}

export function claimAdventureAttemptSettlement(
  lifecycle: AdventureAttemptLifecycle,
  expectedAttemptId: number
): AdventureAttemptSettlementClaim {
  if (lifecycle.attemptId !== expectedAttemptId || lifecycle.settled) {
    return { lifecycle, claimed: false };
  }

  return {
    lifecycle: { ...lifecycle, settled: true },
    claimed: true
  };
}
