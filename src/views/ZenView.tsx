import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookOpen, CheckCircle2, Library, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchChunkStream, fetchSourceMap, fetchSources, reportProgress } from "../api";
import { ModeSwitch } from "../components/ModeSwitch";
import { TypingCanvas } from "../components/TypingCanvas";
import { useTypingCore } from "../store/typingCore";
import type { ContentNode, InputMode, MapChunk, Source } from "../types";

interface ZenViewProps {
  inputMode: InputMode;
  onExit: () => void;
}

function displayMeta(source: Source) {
  const level = typeof source.metadata.level === "string" ? source.metadata.level : "B1";
  const genre = typeof source.metadata.genre === "string" ? source.metadata.genre : "reading";
  const minutes = typeof source.metadata.minutes === "number" ? `${source.metadata.minutes} min` : "short";
  return `${genre} / ${level} / ${minutes}`;
}

function applyChunkProgress(chunks: MapChunk[], chunkId: string, nextSequence: number) {
  return chunks.map((chunk) => {
    if (chunk.id !== chunkId) return chunk;
    return {
      ...chunk,
      progress: {
        ...chunk.progress,
        lastNodeSequence: Math.max(chunk.progress.lastNodeSequence, nextSequence)
      }
    };
  });
}

export function ZenView({ inputMode, onExit }: ZenViewProps) {
  const [mode, setMode] = useState<InputMode>(inputMode);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [chunks, setChunks] = useState<MapChunk[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<MapChunk | null>(null);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [activeLine, setActiveLine] = useState(0);
  const [finished, setFinished] = useState(false);
  const completed = useTypingCore((state) => state.completed);
  const metrics = useTypingCore((state) => state.metrics);

  useEffect(() => {
    fetchSources("BOOK")
      .then((items) => {
        setSources(items);
        setSelectedSource(items[0] ?? null);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedSource) return;
    fetchSourceMap(selectedSource.id)
      .then((items) => {
        setChunks(items);
        setSelectedChunk(null);
        setNodes([]);
        setActiveLine(0);
        setFinished(false);
      })
      .catch(console.error);
  }, [selectedSource]);

  async function startChunk(chunk: MapChunk, restart = false) {
    const saved = restart ? 1 : Math.max(1, chunk.progress.lastNodeSequence ?? 1);
    const stream = await fetchChunkStream(chunk.id, saved, 80);
    setSelectedChunk(chunk);
    setNodes(stream.nodes);
    setActiveLine(0);
    setFinished(stream.nodes.length === 0);
  }

  const visibleNodes = useMemo(() => nodes.slice(activeLine, activeLine + 3), [activeLine, nodes]);
  const activeNode = visibleNodes[0];
  const progressText = selectedChunk && activeNode ? `${activeNode.sequence}/${selectedChunk.wordCount ? nodes.length + activeLine : nodes.length}` : "";

  useEffect(() => {
    if (!completed || !selectedChunk || !activeNode) return;
    const handle = window.setTimeout(() => {
      const nextSeq = activeNode.sequence + 1;
      const finalMetrics = metrics();
      void reportProgress({
        chunk_id: selectedChunk.id,
        wpm: finalMetrics.wpm,
        accuracy: finalMetrics.accuracy,
        current_seq: nextSeq
      })
        .then((result) => {
          setChunks((current) =>
            current.map((chunk) => {
              if (chunk.id !== selectedChunk.id) return chunk;
              return {
                ...chunk,
                progress: {
                  ...chunk.progress,
                  highestWpm: Math.max(chunk.progress.highestWpm, result.progress.highestWpm),
                  highestAccuracy: Math.max(chunk.progress.highestAccuracy, result.progress.highestAccuracy),
                  starsEarned: Math.max(chunk.progress.starsEarned, result.progress.starsEarned),
                  lastNodeSequence: result.progress.lastNodeSequence,
                  isCompleted: result.progress.isCompleted
                }
              };
            })
          );
        })
        .catch(console.error);

      if (activeLine + 1 >= nodes.length) {
        setFinished(true);
      } else {
        setActiveLine((line) => line + 1);
        setChunks((current) => applyChunkProgress(current, selectedChunk.id, nextSeq));
      }
    }, 260);
    return () => window.clearTimeout(handle);
  }, [activeLine, activeNode, completed, metrics, nodes.length, selectedChunk]);

  if (!selectedChunk || !activeNode || finished) {
    return (
      <main className="min-h-screen bg-[#090a08] px-4 py-5 text-stone-100">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <button className="flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-stone-300" onClick={onExit} type="button">
            <ArrowLeft size={16} />
            冒险模式
          </button>
          <ModeSwitch view="zen" inputMode={mode} onViewChange={(view) => view === "adventure" && onExit()} onInputModeChange={setMode} />
        </div>

        <section className="mx-auto mt-8 grid max-w-7xl gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-md border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-4 flex items-center gap-2 text-emerald-300">
              <Library size={20} />
              <h1 className="text-lg font-semibold text-stone-50">Zen Library</h1>
            </div>
            <div className="space-y-2">
              {sources.map((source) => (
                <button
                  key={source.id}
                  className={`w-full rounded-md border p-3 text-left transition ${
                    source.id === selectedSource?.id ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-black/20 hover:border-white/25"
                  }`}
                  onClick={() => setSelectedSource(source)}
                  type="button"
                >
                  <p className="font-semibold text-stone-50">{source.title}</p>
                  <p className="mt-1 text-xs text-stone-400">{displayMeta(source)}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="rounded-md border border-white/10 bg-white/[0.035] p-5">
            {finished && selectedChunk ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <CheckCircle2 className="mb-4 text-emerald-300" size={46} />
                <h2 className="text-3xl font-semibold">已完成：{selectedChunk.title}</h2>
                <p className="mt-3 max-w-xl text-stone-400">这篇已经打完。你可以从头再练一次，也可以换一篇继续。</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    className="flex h-10 items-center gap-2 rounded-md bg-emerald-300 px-4 font-semibold text-stone-950"
                    onClick={() => void startChunk(selectedChunk, true)}
                    type="button"
                  >
                    <RotateCcw size={16} />
                    从头再来
                  </button>
                  <button className="h-10 rounded-md border border-white/10 px-4 text-stone-300" onClick={() => setFinished(false)} type="button">
                    返回书库
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <BookOpen className="text-emerald-300" size={24} />
                  <div>
                    <h2 className="text-2xl font-semibold text-stone-50">{selectedSource?.title ?? "选择一本读物"}</h2>
                    <p className="text-sm text-stone-400">选择章节后进入无干扰连续输入。</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {chunks.map((chunk) => {
                    const saved = Math.max(1, chunk.progress.lastNodeSequence ?? 1);
                    const hasProgress = saved > 1;
                    return (
                      <button
                        key={chunk.id}
                        className="rounded-md border border-white/10 bg-black/20 p-4 text-left transition hover:border-emerald-300/70 hover:bg-emerald-300/5"
                        onClick={() => void startChunk(chunk)}
                        type="button"
                      >
                        <p className="text-sm text-emerald-300">Chapter {chunk.sectionNum}</p>
                        <h3 className="mt-1 text-lg font-semibold text-stone-50">{chunk.title}</h3>
                        <p className="mt-2 text-sm text-stone-400">{chunk.wordCount} words</p>
                        {hasProgress && <p className="mt-3 text-xs text-amber-200">从第 {saved} 句继续</p>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#090a08] px-5 text-stone-100">
      <button
        className="absolute left-5 top-5 flex h-10 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-stone-300"
        onClick={() => {
          setSelectedChunk(null);
          setNodes([]);
          setActiveLine(0);
        }}
        type="button"
      >
        <ArrowLeft size={16} />
        书库
      </button>
      <div className="absolute right-5 top-5 text-right text-xs text-stone-600">
        <p>{selectedSource?.title}</p>
        <p>{selectedChunk.title} {progressText}</p>
      </div>
      <div className="w-full max-w-5xl">
        <div className="relative h-[13.5rem] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedChunk.id}-${activeLine}`}
              className="space-y-6"
              initial={{ y: 36, opacity: 0.55 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -36, opacity: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              {visibleNodes.map((node, index) => (
                <div
                  key={node.id}
                  className={`min-h-16 transition-opacity duration-300 ${index === 0 ? "opacity-100" : "opacity-35"}`}
                >
                  {index === 0 ? (
                    <TypingCanvas text={node.rawText} inputMode={mode} compact />
                  ) : (
                    <p className="font-mono text-[20px] leading-[2.25rem] text-stone-600 sm:text-[24px]">{node.rawText}</p>
                  )}
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
