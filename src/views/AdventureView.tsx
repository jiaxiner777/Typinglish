import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock3, Lock, MapPin, Play, Sparkles, Star, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  challengeSummary,
  evaluateAdventureAttempt,
  resolveAdventureConfig,
  type AdventureConfig,
  type AdventureEvaluation,
  type AdventureFailureReason,
  type AttemptMetrics
} from "../../shared/adventure/evaluator";
import { fetchAllChunkNodes, fetchSourceMap, reportProgress } from "../api";
import { TypingCanvas } from "../components/TypingCanvas";
import {
  beginAdventureAttempt,
  claimAdventureAttemptSettlement,
  createAdventureAttemptLifecycle,
  getAdventureAttemptRemainingSeconds,
  isAdventureAttemptTimedOut,
  startAdventureAttemptClock
} from "../store/adventureAttempt";
import { mapProgressForIdentity, useGuestProgress } from "../store/guestProgress";
import { useTypingCore } from "../store/typingCore";
import type { ContentNode, Identity, MapChunk, ProgressResult, Source } from "../types";
import { joinNodeText } from "../utils/stats";

interface AdventureViewProps {
  identity: Identity;
  source: Source | null;
}

type ResultState = AttemptMetrics & AdventureEvaluation;

const zoneNames: Record<string, string> = {
  "central-perk": "Central Perk",
  midtown: "Midtown Office",
  subway: "Subway Line",
  downtown: "Downtown Blocks",
  rooftop: "Rooftop Finale",
  terminal: "Terminal Dock",
  backend: "API Kitchen",
  release: "Release Ramp"
};

const zoneColors: Record<string, string> = {
  "central-perk": "from-emerald-400 to-teal-300",
  midtown: "from-sky-300 to-cyan-300",
  subway: "from-amber-300 to-lime-300",
  downtown: "from-rose-300 to-orange-300",
  rooftop: "from-violet-300 to-fuchsia-300",
  terminal: "from-emerald-300 to-lime-300",
  backend: "from-cyan-300 to-blue-300",
  release: "from-amber-300 to-yellow-200"
};

function configForChunk(chunk: MapChunk) {
  return resolveAdventureConfig(chunk.metadata, Math.max(1, chunk.wordCount * 5));
}

function failureReasonText(reason: AdventureFailureReason | null) {
  if (reason === "TIMED_OUT") return "时间已耗尽，本次 Sprint 未完成。";
  if (reason === "FIRST_ERROR") return "首次错误导致本次挑战结束。";
  if (reason === "ACCURACY_TOO_LOW") return "正确率未达到本关门槛。";
  if (reason === "WPM_TOO_LOW") return "速度未达到本关门槛。";
  if (reason === "TOO_MANY_ERRORS") return "错误次数超过本关限制。";
  if (reason === "INPUT_MODE_MISMATCH") return "本次输入模式与关卡配置不一致。";
  if (reason === "INCOMPLETE") return "本次未完成全文。";
  return null;
}

function updateAuthenticatedProgress(chunks: MapChunk[], result: ProgressResult) {
  const next = chunks.map((chunk) =>
    chunk.id === result.chunkId
      ? {
          ...chunk,
          progress: {
            ...chunk.progress,
            highestWpm: Math.max(chunk.progress.highestWpm, result.wpm),
            highestAccuracy: Math.max(chunk.progress.highestAccuracy, result.accuracy),
            starsEarned: Math.max(chunk.progress.starsEarned, result.starsEarned),
            lastNodeSequence: Math.max(chunk.progress.lastNodeSequence, result.currentSequence),
            isCompleted: chunk.progress.isCompleted || result.isCompleted
          }
        }
      : chunk
  );
  const completedIds = new Set(next.filter((chunk) => chunk.progress.isCompleted).map((chunk) => chunk.id));
  return next.map((chunk) => ({
    ...chunk,
    locked: chunk.dependencies.some((dependencyId) => !completedIds.has(dependencyId))
  }));
}

function isUnlockedNow(chunk: MapChunk, chunks: MapChunk[]) {
  if (chunk.locked || chunk.progress.isCompleted) return false;
  return chunk.dependencies.some((dependency) => chunks.find((item) => item.id === dependency)?.progress.isCompleted);
}

function TypewriterAirship() {
  return (
    <motion.div
      className="pointer-events-none absolute -right-7 -top-7 z-20"
      animate={{ y: [0, -7, 0], rotate: [-2, 2, -2] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="relative h-12 w-20">
        <div className="absolute left-2 top-2 h-7 w-14 rounded-full border border-emerald-100 bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.45)]" />
        <div className="absolute left-7 top-7 h-4 w-8 rounded-sm border border-stone-700 bg-stone-950" />
        <div className="absolute left-9 top-8 grid grid-cols-3 gap-[2px]">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="h-[3px] w-[3px] bg-emerald-200" />
          ))}
        </div>
        <div className="absolute left-0 top-4 h-3 w-4 rounded-l-full bg-amber-300" />
      </div>
    </motion.div>
  );
}

export function AdventureView({ identity, source }: AdventureViewProps) {
  const [baseChunks, setBaseChunks] = useState<MapChunk[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<MapChunk | null>(null);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [result, setResult] = useState<ResultState | null>(null);
  const [loading, setLoading] = useState(false);
  const [attemptKey, setAttemptKey] = useState(0);
  const [settling, setSettling] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [attemptDeadlineMs, setAttemptDeadlineMs] = useState<number | null>(null);
  const attemptLifecycleRef = useRef(createAdventureAttemptLifecycle());
  const progressByChunk = useGuestProgress((state) => state.progressByChunk);
  const reportGuestProgress = useGuestProgress((state) => state.reportProgress);
  const chunks = useMemo(
    () => mapProgressForIdentity(baseChunks, progressByChunk, identity.kind),
    [baseChunks, identity.kind, progressByChunk]
  );

  useEffect(() => {
    if (!source) {
      setBaseChunks([]);
      return;
    }
    fetchSourceMap(source.id)
      .then((response) => {
        if (response.identity.kind !== identity.kind) throw new Error("Unexpected public identity");
        setBaseChunks(response.chunks);
      })
      .catch(console.error);
  }, [identity.kind, source]);

  const lessonText = useMemo(() => joinNodeText(nodes.map((node) => node.rawText)), [nodes]);
  const selectedConfig = useMemo<AdventureConfig | null>(
    () => (selectedChunk ? resolveAdventureConfig(selectedChunk.metadata, Math.max(1, lessonText.length)) : null),
    [lessonText.length, selectedChunk]
  );
  const completedCount = chunks.filter((chunk) => chunk.progress.isCompleted).length;
  const currentAirshipIndex = Math.max(0, chunks.findIndex((chunk) => !chunk.progress.isCompleted && !chunk.locked));

  function beginAttempt() {
    const lifecycle = beginAdventureAttempt(attemptLifecycleRef.current);
    attemptLifecycleRef.current = lifecycle;
    setAttemptDeadlineMs(null);
    setRemainingSeconds(null);
    setAttemptKey(lifecycle.attemptId);
  }

  async function selectChunk(chunk: MapChunk) {
    if (chunk.locked || result || loading) return;
    setSelectedChunk(chunk);
    setResult(null);
    setNodes([]);
    setSettling(false);
    beginAttempt();
    setLoading(true);
    try {
      setNodes(await fetchAllChunkNodes(chunk.id));
    } finally {
      setLoading(false);
    }
  }

  const settleAttempt = useCallback(
    (settlingAttemptId: number, timedOut: boolean, completedOverride?: boolean) => {
      if (!selectedChunk || !selectedConfig || !lessonText) return;
      const claim = claimAdventureAttemptSettlement(attemptLifecycleRef.current, settlingAttemptId);
      if (!claim.claimed) return;
      attemptLifecycleRef.current = claim.lifecycle;
      setAttemptDeadlineMs(null);
      setSettling(true);

      const coreMetrics = useTypingCore.getState().metrics();
      const attemptMetrics: AttemptMetrics = {
        ...coreMetrics,
        completed: completedOverride ?? coreMetrics.completed,
        timedOut
      };
      const evaluation = evaluateAdventureAttempt(selectedConfig, attemptMetrics);
      const resultState: ResultState = { ...attemptMetrics, ...evaluation };
      const currentSequence = nodes[nodes.length - 1]?.sequence ?? 1;
      setResult(resultState);

      if (identity.kind === "anonymous") {
        reportGuestProgress({
          chunkId: selectedChunk.id,
          wpm: attemptMetrics.wpm,
          accuracy: attemptMetrics.accuracy,
          currentSequence,
          starsEarned: evaluation.stars,
          passed: evaluation.passed
        });
      }

      void reportProgress({
        chunk_id: selectedChunk.id,
        wpm: attemptMetrics.wpm,
        accuracy: attemptMetrics.accuracy,
        error_count: attemptMetrics.errorCount,
        elapsed_seconds: attemptMetrics.elapsedSeconds,
        input_mode: attemptMetrics.inputMode,
        completed: attemptMetrics.completed,
        timed_out: attemptMetrics.timedOut,
        current_seq: currentSequence
      })
        .then((response) => {
          if (identity.kind === "authenticated" && response.identity.kind === "authenticated") {
            setBaseChunks((current) => updateAuthenticatedProgress(current, response.result));
          }
        })
        .catch(() => {
          // The local result remains visible; authenticated progress can be retried.
        });
    }, [identity.kind, lessonText, nodes, reportGuestProgress, selectedChunk, selectedConfig]
  );

  function handleComplete(event: { text: string; resetToken: number }) {
    if (event.text !== lessonText) return;
    settleAttempt(event.resetToken, false, true);
  }

  function handleTypingError(event: { text: string; resetToken: number }) {
    if (
      event.text === lessonText &&
      selectedConfig?.challengeType === "PERFECT_RUN"
    ) {
      settleAttempt(event.resetToken, false, false);
    }
  }

  function handleTypingStart(event: { text: string; resetToken: number; startedAt: number }) {
    if (event.text !== lessonText || selectedConfig?.challengeType !== "SPRINT") return;
    const limit = selectedConfig.timeLimitSeconds as number;
    const lifecycle = startAdventureAttemptClock(
      attemptLifecycleRef.current,
      event.resetToken,
      event.startedAt,
      limit
    );
    if (lifecycle === attemptLifecycleRef.current) return;
    attemptLifecycleRef.current = lifecycle;
    setAttemptDeadlineMs(lifecycle.deadlineMs);
    setRemainingSeconds(limit);
  }

  useEffect(() => {
    if (!selectedConfig || selectedConfig.challengeType !== "SPRINT") {
      setRemainingSeconds(null);
      return;
    }
    if (attemptDeadlineMs === null || result) return;
    const timerAttemptId = attemptKey;

    const tick = () => {
      const lifecycle = attemptLifecycleRef.current;
      const remaining = getAdventureAttemptRemainingSeconds(lifecycle, timerAttemptId, Date.now());
      if (remaining === null || lifecycle.deadlineMs !== attemptDeadlineMs) return;
      setRemainingSeconds(remaining);
      if (isAdventureAttemptTimedOut(lifecycle, timerAttemptId, Date.now())) {
        settleAttempt(timerAttemptId, true, false);
      }
    };
    tick();
    const handle = window.setInterval(tick, 100);
    return () => window.clearInterval(handle);
  }, [attemptDeadlineMs, attemptKey, result, selectedConfig, settleAttempt]);

  function handleResultAction() {
    if (!result) return;
    if (result.passed) {
      setResult(null);
      setSettling(false);
      setSelectedChunk(null);
      setNodes([]);
      return;
    }
    setResult(null);
    setSettling(false);
    beginAttempt();
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-92px)] w-full max-w-7xl grid-cols-1 gap-6 px-4 pb-8 lg:grid-cols-[500px_1fr]">
      <section className="typing-grid relative overflow-hidden rounded-md border border-white/10 bg-[#10140f]/80 p-5 shadow-glow">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-300/10 to-transparent" />
        <div className="relative mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">Adventure Map</p>
            <h2 className="mt-2 text-3xl font-semibold text-stone-50">{source?.title ?? "Loading"}</h2>
            <p className="mt-2 text-sm text-stone-400">单线成长路径 / {completedCount} of {chunks.length} cleared</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-right">
            <p className="text-xs text-stone-500">Airship</p>
            <p className="text-sm font-semibold text-emerald-200">Typing Mk.I</p>
          </div>
        </div>

        <div className="adventure-scroll relative max-h-[calc(100vh-190px)] overflow-y-auto px-2 pb-8 pt-4">
          <div className="relative mx-auto min-h-[980px] max-w-[390px]">
            {chunks.map((chunk, index) => {
              const config = configForChunk(chunk);
              const top = 24 + index * 118;
              const left = 150 + (chunk.mapPosX || (index % 2 === 0 ? -1 : 1)) * 58;
              const completed = chunk.progress.isCompleted;
              const unlockedNow = isUnlockedNow(chunk, chunks);
              const color = zoneColors[chunk.mapZone] ?? "from-emerald-300 to-teal-300";
              const zoneChanged = index === 0 || chunks[index - 1]?.mapZone !== chunk.mapZone;
              const isAirshipHere = index === currentAirshipIndex || (completedCount === chunks.length && index === chunks.length - 1);

              return (
                <div key={chunk.id}>
                  {zoneChanged && (
                    <div className="absolute left-0 right-0 flex items-center gap-3" style={{ top: top - 28 }}>
                      <span className={`h-2 w-2 rounded-full bg-gradient-to-br ${color}`} />
                      <span className="text-xs uppercase tracking-[0.18em] text-stone-500">{zoneNames[chunk.mapZone] ?? chunk.mapZone}</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                  )}

                  {index > 0 && (
                    <motion.div
                      className={`absolute z-0 h-[96px] w-[74px] border-b-4 border-l-4 ${
                        chunk.locked ? "border-dashed border-stone-700" : "border-emerald-300"
                      }`}
                      initial={{ scaleY: 0.2, opacity: 0.35 }}
                      animate={{ scaleY: 1, opacity: 1 }}
                      transition={{ duration: 0.45, delay: index * 0.04 }}
                      style={{
                        top: top - 91,
                        left: left > 150 ? left - 51 : left + 38,
                        transformOrigin: "top"
                      }}
                    />
                  )}

                  <motion.button
                    type="button"
                    disabled={chunk.locked || Boolean(result) || loading}
                    onClick={() => void selectChunk(chunk)}
                    className={`island-button absolute z-10 h-20 w-24 border text-sm transition ${
                      chunk.locked
                        ? "cursor-not-allowed border-stone-700 bg-stone-900 text-stone-500 opacity-70"
                        : completed
                          ? "border-amber-200 bg-gradient-to-br from-amber-200 to-yellow-400 text-stone-950"
                          : `border-white/30 bg-gradient-to-br ${color} text-stone-950`
                    }`}
                    initial={{ scale: 0, y: 16 }}
                    animate={{ scale: unlockedNow ? [0, 1.18, 1] : [0, 1.05, 1], y: 0 }}
                    whileHover={!chunk.locked ? { y: -4, scale: 1.04 } : undefined}
                    transition={{ duration: 0.42, delay: index * 0.055 }}
                    style={{ top, left }}
                    title={chunk.title}
                  >
                    {isAirshipHere && <TypewriterAirship />}
                    <span className="absolute -top-3 left-1/2 flex h-7 min-w-7 -translate-x-1/2 items-center justify-center rounded-md border border-white/20 bg-stone-950 px-2 text-xs font-bold text-stone-100">
                      {chunk.sectionNum}
                    </span>
                    <span className="flex h-full flex-col items-center justify-center gap-1">
                      {chunk.locked ? <Lock size={21} /> : completed ? <Check size={22} /> : <Play size={22} />}
                      <span className="max-w-[86px] text-[10px] font-bold uppercase leading-3">{challengeSummary(config)}</span>
                    </span>
                  </motion.button>

                  {!completed && !chunk.locked && (
                    <motion.div
                      className="absolute z-20 rounded-md border border-emerald-200/40 bg-stone-950 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-200"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ top: top + 80, left: left + 2 }}
                    >
                      Next
                    </motion.div>
                  )}

                  {chunk.locked && (
                    <motion.div
                      className="roadblock absolute z-20 h-8 w-20 border border-rose-300/40 bg-rose-950/80"
                      initial={{ rotateX: 0 }}
                      animate={{ rotateX: [0, -12, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      style={{ top: top + 88, left: left + 2 }}
                    />
                  )}

                  <div
                    className={`absolute z-10 w-40 ${left > 150 ? "right-[250px] text-right" : "left-[250px] text-left"}`}
                    style={{ top: top + 10 }}
                  >
                    <p className="text-sm font-semibold text-stone-100">{chunk.title}</p>
                    <p className="mt-1 text-xs text-stone-500">Level {chunk.sectionNum}</p>
                    <div className={`mt-1 flex gap-1 ${left > 150 ? "justify-end" : ""}`}>
                      {Array.from({ length: 3 }).map((_, starIndex) => (
                        <Star
                          key={starIndex}
                          size={14}
                          className={starIndex < chunk.progress.starsEarned ? "fill-amber-300 text-amber-300" : "text-stone-700"}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-md border border-white/10 bg-[#10130f]/90 p-5 sm:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 bg-emerald-300/10 blur-3xl" />
        {!selectedChunk && (
          <div className="flex h-full min-h-[520px] items-center justify-center text-center text-stone-400">
            <div>
              <MapPin className="mx-auto mb-4 text-emerald-300" size={40} />
              <p className="text-lg text-stone-200">选择一个已解锁关卡开始训练。</p>
              <p className="mt-2 text-sm">清完一关，前方桥梁会亮起，飞艇继续向下一个街区移动。</p>
            </div>
          </div>
        )}

        {selectedChunk && (
          <div className="relative space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-emerald-300">Level {selectedChunk.sectionNum} / {zoneNames[selectedChunk.mapZone] ?? selectedChunk.mapZone}</p>
                <h2 className="text-3xl font-semibold text-stone-50">{selectedChunk.title}</h2>
              </div>
              {selectedConfig && (
                <div className="flex items-center gap-3 rounded-md border border-white/10 px-3 py-2 text-sm text-stone-300">
                  <Target size={16} className="text-emerald-300" />
                  <span>{challengeSummary(selectedConfig)}</span>
                  <span className="text-stone-500">/</span>
                  <span>{selectedConfig.inputMode === "STRICT" ? "Strict" : "Tolerant"}</span>
                </div>
              )}
            </div>

            {selectedConfig?.challengeType === "SPRINT" && (
              <div className="flex h-12 items-center justify-between rounded-md border border-amber-200/20 bg-amber-200/5 px-4">
                <div className="flex items-center gap-2 text-sm text-amber-100">
                  <Clock3 size={17} />
                  Sprint timer
                </div>
                <span className={`font-mono text-xl font-semibold ${(remainingSeconds ?? 0) <= 5 ? "text-rose-300" : "text-amber-200"}`}>
                  {(remainingSeconds ?? selectedConfig.timeLimitSeconds ?? 0).toFixed(1)}s
                </span>
              </div>
            )}

            <div className="min-h-[300px] rounded-md border border-white/10 bg-black/25 p-5">
              {loading ? (
                <p className="text-stone-400">Loading...</p>
              ) : settling ? (
                <div className="flex min-h-[230px] items-center justify-center text-sm text-stone-500">正在结算...</div>
              ) : (
                lessonText && (
                  <TypingCanvas
                    key={`${selectedChunk.id}-${attemptKey}`}
                    text={lessonText}
                    inputMode={selectedConfig?.inputMode ?? "STRICT"}
                    resetToken={attemptKey}
                    onStart={handleTypingStart}
                    onComplete={handleComplete}
                    onError={handleTypingError}
                  />
                )
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {nodes.map((node) => (
                <div key={node.id} className="rounded-md border border-white/10 bg-stone-950/50 p-3">
                  <p className="text-sm text-stone-300">{node.translation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              className="absolute inset-0 z-30 flex items-center justify-center rounded-md bg-black/72 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-[min(92vw,440px)] rounded-md border border-white/10 bg-stone-950 p-6 text-center shadow-glow"
                initial={{ scale: 0.9, y: 24 }}
                animate={{ scale: 1, y: 0 }}
              >
                <p className="text-sm uppercase tracking-[0.24em] text-emerald-300">Result</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white/5 p-4">
                    <p className="text-3xl font-semibold">{result.wpm}</p>
                    <p className="text-sm text-stone-400">WPM</p>
                  </div>
                  <div className="rounded-md bg-white/5 p-4">
                    <p className="text-3xl font-semibold">{result.accuracy}%</p>
                    <p className="text-sm text-stone-400">正确率</p>
                  </div>
                  <div className="rounded-md bg-white/5 p-4">
                    <p className="text-3xl font-semibold">{result.errorCount}</p>
                    <p className="text-sm text-stone-400">错误次数</p>
                  </div>
                  <div className="rounded-md bg-white/5 p-4">
                    <p className="text-3xl font-semibold">{result.elapsedSeconds.toFixed(1)}s</p>
                    <p className="text-sm text-stone-400">用时</p>
                  </div>
                </div>
                <div className="mt-5 flex justify-center gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <motion.div
                      key={index}
                      initial={{ scale: 0, y: -34, rotate: -18 }}
                      animate={{ scale: index < result.stars ? [0, 1.55, 1] : 1, y: 0, rotate: 0 }}
                      transition={{ type: "spring", delay: 0.16 + index * 0.18 }}
                    >
                      <Star size={42} className={index < result.stars ? "fill-amber-300 text-amber-300" : "text-stone-700"} />
                    </motion.div>
                  ))}
                </div>
                {result.passed ? (
                  <motion.div className="mt-4 flex items-center justify-center gap-2 text-sm text-emerald-200" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Sparkles size={16} />
                    新桥梁已点亮，飞艇准备出发
                  </motion.div>
                ) : (
                  <p className="mt-4 text-sm text-rose-200">{failureReasonText(result.failureReason)}</p>
                )}
                {result.nextStarHint && <p className="mt-2 text-sm text-stone-400">{result.nextStarHint}</p>}
                <button
                  className="mt-6 h-10 rounded-md bg-emerald-300 px-5 font-semibold text-stone-950"
                  onClick={handleResultAction}
                  type="button"
                >
                  {result.passed ? "继续" : "再试一次"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
