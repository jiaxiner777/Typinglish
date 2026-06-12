import { AnimatePresence, motion } from "framer-motion";
import { Check, Flag, Lock, MapPin, Play, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchChunkStream, fetchSourceMap, reportProgress } from "../api";
import { TypingCanvas } from "../components/TypingCanvas";
import { useTypingCore } from "../store/typingCore";
import type { ContentNode, InputMode, MapChunk, Source } from "../types";
import { calculateStars, joinNodeText } from "../utils/stats";

interface AdventureViewProps {
  source: Source | null;
  inputMode: InputMode;
}

interface ResultState {
  wpm: number;
  accuracy: number;
  stars: number;
}

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

function challengeLabel(index: number) {
  return ["提示盲打", "速度挑战", "精准复盘"][index % 3];
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

export function AdventureView({ source, inputMode }: AdventureViewProps) {
  const [chunks, setChunks] = useState<MapChunk[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<MapChunk | null>(null);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [result, setResult] = useState<ResultState | null>(null);
  const [loading, setLoading] = useState(false);
  const [attemptKey, setAttemptKey] = useState(0);
  const [settling, setSettling] = useState(false);
  const settledAttemptRef = useRef<number | null>(null);
  const metrics = useTypingCore((state) => state.metrics);

  useEffect(() => {
    if (!source) return;
    fetchSourceMap(source.id).then(setChunks).catch(console.error);
  }, [source]);

  const lessonText = useMemo(() => joinNodeText(nodes.map((node) => node.rawText)), [nodes]);
  const completedCount = chunks.filter((chunk) => chunk.progress.isCompleted).length;
  const currentAirshipIndex = Math.max(0, chunks.findIndex((chunk) => !chunk.progress.isCompleted && !chunk.locked));

  async function selectChunk(chunk: MapChunk) {
    if (chunk.locked || result || loading) return;
    setSelectedChunk(chunk);
    setResult(null);
    setNodes([]);
    setAttemptKey((key) => {
      const nextKey = key + 1;
      settledAttemptRef.current = null;
      return nextKey;
    });
    setLoading(true);
    try {
      const stream = await fetchChunkStream(chunk.id, 1, 12);
      setNodes(stream.nodes);
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(event: { text: string; resetToken: number }) {
    if (
      !selectedChunk ||
      settledAttemptRef.current === attemptKey ||
      event.resetToken !== attemptKey ||
      event.text !== lessonText
    ) {
      return;
    }
    settledAttemptRef.current = attemptKey;
    setSettling(true);
    const finalMetrics = metrics();
    const stars = calculateStars(finalMetrics.wpm, finalMetrics.accuracy);
    setResult({ ...finalMetrics, stars });
    await reportProgress({
      chunk_id: selectedChunk.id,
      wpm: finalMetrics.wpm,
      accuracy: finalMetrics.accuracy,
      current_seq: nodes[nodes.length - 1]?.sequence ?? 1
    });
  }

  async function handleResultAction() {
    if (!result) return;
    if (result.stars > 0) {
      if (source) {
        const nextMap = await fetchSourceMap(source.id);
        setChunks(nextMap);
      }
      setResult(null);
      setSettling(false);
      setSelectedChunk(null);
      setNodes([]);
      return;
    }
    setResult(null);
    setSettling(false);
    setAttemptKey((key) => {
      const nextKey = key + 1;
      settledAttemptRef.current = null;
      return nextKey;
    });
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
                      <span className="text-[11px] font-bold uppercase tracking-wide">{challengeLabel(index)}</span>
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
              <div className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-300">
                {inputMode === "STRICT" ? "错字死锁" : "错字前行"}
              </div>
            </div>

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
                    inputMode={inputMode}
                    resetToken={attemptKey}
                    onComplete={(event) => void handleComplete(event)}
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
                {result.stars > 0 && (
                  <motion.div className="mt-4 flex items-center justify-center gap-2 text-sm text-emerald-200" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Sparkles size={16} />
                    新桥梁已点亮，飞艇准备出发
                  </motion.div>
                )}
                <button
                  className="mt-6 h-10 rounded-md bg-emerald-300 px-5 font-semibold text-stone-950"
                  onClick={() => void handleResultAction()}
                  type="button"
                >
                  {result.stars > 0 ? "继续" : "再试一次"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
