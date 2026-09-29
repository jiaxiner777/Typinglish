import { ArrowLeft, BookPlus, PencilLine, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  archiveAdminSource,
  authenticateAdmin,
  clearAdminToken,
  createAdminChunk,
  createAdminNode,
  createAdminSource,
  deleteAdminChunk,
  deleteAdminNode,
  listAdminChunks,
  listAdminNodes,
  listAdminSources,
  publishAdminSource,
  updateAdminChunk,
  updateAdminNode,
  updateAdminSource
} from "../../api/admin";
import type { Chunk, ContentNode, Source, SourceStatus, SourceType } from "../../types";

const sourceTypes: SourceType[] = ["BOOK", "SERIES", "VOCAB"];
const sourceStatuses: SourceStatus[] = ["draft", "published", "archived"];

function emptySourceDraft(): Pick<Source, "title" | "type" | "slug" | "status" | "sortOrder" | "metadata" | "coverUrl"> {
  return {
    title: "",
    type: "BOOK",
    slug: "",
    status: "draft",
    sortOrder: 0,
    metadata: {},
    coverUrl: null
  };
}

function metadataText(metadata: Record<string, unknown>) {
  return JSON.stringify(metadata, null, 2);
}

export function AdminApp() {
  const [authorized, setAuthorized] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authenticateAdmin(token);
      setToken("");
      setAuthorized(true);
    } catch {
      setError("无法进入后台，请检查管理密钥或稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (authorized) {
    return <>
      <div className="mx-auto flex max-w-7xl justify-end px-4 pt-4">
        <button type="button" className="text-sm text-stone-300 hover:text-white" onClick={() => { clearAdminToken(); setAuthorized(false); }}>锁定后台</button>
      </div>
      <AdminWorkspace />
    </>;
  }

  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
    <a href="/" className="mb-6 text-sm text-emerald-300">← 返回练习</a>
    <h1 className="text-2xl font-semibold text-stone-50">内容管理</h1>
    <p className="mt-2 text-sm text-stone-400">仅供管理员使用。关闭或刷新页面后，需要重新输入管理密钥。</p>
    <form onSubmit={(event) => void unlock(event)} className="mt-6 space-y-4">
      <label className="block text-sm text-stone-200" htmlFor="admin-key">管理密钥</label>
      <input id="admin-key" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} required className="h-12 w-full rounded-md border border-white/15 bg-stone-900 px-3 text-stone-50" />
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <button disabled={busy} type="submit" className="h-12 w-full rounded-md bg-emerald-300 font-semibold text-stone-950 disabled:opacity-60">{busy ? "正在验证…" : "进入后台"}</button>
    </form>
  </main>;
}

function AdminWorkspace() {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [selectedChunkId, setSelectedChunkId] = useState<string>("");
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [statusFilter, setStatusFilter] = useState<SourceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [sourceDraft, setSourceDraft] = useState(emptySourceDraft());
  const [metadataDraft, setMetadataDraft] = useState("{}");
  const [chunkDraft, setChunkDraft] = useState({ title: "", chapterNum: 1, sectionNum: 1, mapZone: "default", mapPosX: 0, mapPosY: 0, summary: "" });
  const [nodeDraft, setNodeDraft] = useState({ sequence: 1, rawText: "", cleanText: "", translation: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadSources() {
    setBusy(true);
    setError(null);
    try {
      const rows = await listAdminSources({ status: statusFilter === "all" ? undefined : statusFilter, q: search || undefined });
      setSources(rows);
      setSelectedSourceId((current) => current || rows[0]?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载 sources 失败");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadSources();
  }, [statusFilter, search]);

  useEffect(() => {
    if (!selectedSourceId) {
      setChunks([]);
      setSelectedChunkId("");
      return;
    }
    void listAdminChunks(selectedSourceId)
      .then((rows) => {
        setChunks(rows);
        setSelectedChunkId((current) => current || rows[0]?.id || "");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "加载 chunks 失败"));
  }, [selectedSourceId]);

  useEffect(() => {
    if (!selectedChunkId) {
      setNodes([]);
      return;
    }
    void listAdminNodes(selectedChunkId)
      .then((rows) => setNodes(rows))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "加载 nodes 失败"));
  }, [selectedChunkId]);

  const selectedSource = useMemo(() => sources.find((item) => item.id === selectedSourceId) ?? null, [selectedSourceId, sources]);
  const selectedChunk = useMemo(() => chunks.find((item) => item.id === selectedChunkId) ?? null, [chunks, selectedChunkId]);

  useEffect(() => {
    if (!selectedSource) {
      setSourceDraft(emptySourceDraft());
      setMetadataDraft("{}");
      return;
    }
    setSourceDraft({
      title: selectedSource.title,
      type: selectedSource.type,
      slug: selectedSource.slug ?? "",
      status: selectedSource.status,
      sortOrder: selectedSource.sortOrder,
      metadata: selectedSource.metadata,
      coverUrl: selectedSource.coverUrl
    });
    setMetadataDraft(metadataText(selectedSource.metadata));
  }, [selectedSource]);

  useEffect(() => {
    if (!selectedChunk) {
      setChunkDraft({ title: "", chapterNum: 1, sectionNum: 1, mapZone: "default", mapPosX: 0, mapPosY: 0, summary: "" });
      return;
    }
    setChunkDraft({
      title: selectedChunk.title,
      chapterNum: selectedChunk.chapterNum,
      sectionNum: selectedChunk.sectionNum,
      mapZone: selectedChunk.mapZone,
      mapPosX: selectedChunk.mapPosX,
      mapPosY: selectedChunk.mapPosY,
      summary: selectedChunk.summary ?? ""
    });
  }, [selectedChunk]);

  async function handleCreateSource() {
    setError(null);
    try {
      const created = await createAdminSource({ title: "New Source", type: "BOOK", slug: "new-source", status: "draft", sortOrder: sources.length + 1, metadata: {} });
      await loadSources();
      setSelectedSourceId(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建 source 失败");
    }
  }

  async function handleSaveSource() {
    if (!selectedSource) return;
    setError(null);
    try {
      const metadata = JSON.parse(metadataDraft) as Record<string, unknown>;
      const updated = await updateAdminSource(selectedSource.id, {
        title: sourceDraft.title,
        type: sourceDraft.type,
        slug: sourceDraft.slug || null,
        status: sourceDraft.status,
        sortOrder: sourceDraft.sortOrder,
        coverUrl: sourceDraft.coverUrl,
        metadata
      });
      setSources((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存 source 失败");
    }
  }

  async function handlePublishSource() {
    if (!selectedSource) return;
    const updated = await publishAdminSource(selectedSource.id);
    setSources((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function handleArchiveSource() {
    if (!selectedSource) return;
    const updated = await archiveAdminSource(selectedSource.id);
    setSources((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function handleCreateChunk() {
    if (!selectedSource) return;
    try {
      const created = await createAdminChunk(selectedSource.id, {
        title: `Chapter ${chunks.length + 1}`,
        chapterNum: 1,
        sectionNum: chunks.length + 1,
        mapZone: "default",
        mapPosX: 0,
        mapPosY: chunks.length,
        summary: ""
      });
      setChunks((current) => [...current, created]);
      setSelectedChunkId(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建 chunk 失败");
    }
  }

  async function handleSaveChunk() {
    if (!selectedChunk) return;
    try {
      const updated = await updateAdminChunk(selectedChunk.id, chunkDraft);
      setChunks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存 chunk 失败");
    }
  }

  async function handleDeleteChunk() {
    if (!selectedChunk) return;
    await deleteAdminChunk(selectedChunk.id);
    setChunks((current) => current.filter((item) => item.id !== selectedChunk.id));
    setSelectedChunkId("");
  }

  async function handleCreateNode() {
    if (!selectedChunk) return;
    try {
      const created = await createAdminNode(selectedChunk.id, {
        sequence: nodes.length + 1,
        rawText: nodeDraft.rawText,
        cleanText: nodeDraft.cleanText || nodeDraft.rawText,
        translation: nodeDraft.translation || null
      });
      setNodes((current) => [...current, created].sort((a, b) => a.sequence - b.sequence));
      setNodeDraft({ sequence: nodes.length + 2, rawText: "", cleanText: "", translation: "" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建 node 失败");
    }
  }

  async function handleUpdateNode(node: ContentNode) {
    const updated = await updateAdminNode(node.id, node);
    setNodes((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort((a, b) => a.sequence - b.sequence));
  }

  async function handleDeleteNode(nodeId: string) {
    await deleteAdminNode(nodeId);
    setNodes((current) => current.filter((item) => item.id !== nodeId));
  }

  return (
    <main className="min-h-screen bg-[#0b0d0b] px-4 py-5 text-stone-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Admin Console</p>
          <h1 className="text-3xl font-semibold">Typinglish 内容管理</h1>
          <p className="text-sm text-stone-400">在 PostgreSQL 中维护 sources、chunks 和 content nodes。</p>
        </div>
        <div className="flex gap-2">
          <a className="flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-stone-200" href="/">
            <ArrowLeft size={16} />
            返回前台
          </a>
          <button className="flex h-10 items-center gap-2 rounded-md bg-sky-300 px-3 text-sm font-medium text-stone-950" onClick={() => void handleCreateSource()} type="button">
            <BookPlus size={16} />
            新建内容包
          </button>
        </div>
      </div>

      {error && <div className="mx-auto mb-4 max-w-7xl rounded-md border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}

      <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[320px_1fr_1fr]">
        <aside className="rounded-md border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">内容包</h2>
            {busy && <span className="text-xs text-stone-500">Loading...</span>}
          </div>
          <div className="mt-3 space-y-2">
            <input className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="搜索 title / slug" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SourceStatus | "all") }>
              <option value="all">全部状态</option>
              {sourceStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="mt-4 space-y-2">
            {sources.map((source) => (
              <button key={source.id} className={`w-full rounded-md border px-3 py-3 text-left ${source.id === selectedSourceId ? "border-sky-300 bg-sky-300/10" : "border-white/10 bg-black/20"}`} onClick={() => setSelectedSourceId(source.id)} type="button">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-stone-50">{source.title}</span>
                  <span className="text-xs uppercase text-stone-400">{source.status}</span>
                </div>
                <p className="mt-1 text-xs text-stone-500">{source.slug || "(no slug)"}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-md border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">内容包详情</h2>
            <div className="flex gap-2">
              <button className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100" onClick={() => void handlePublishSource()} type="button" disabled={!selectedSource}>发布</button>
              <button className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100" onClick={() => void handleArchiveSource()} type="button" disabled={!selectedSource}>归档</button>
              <button className="flex items-center gap-2 rounded-md bg-sky-300 px-3 py-2 text-sm font-medium text-stone-950" onClick={() => void handleSaveSource()} type="button" disabled={!selectedSource}>
                <Save size={14} />
                保存
              </button>
            </div>
          </div>

          {selectedSource ? (
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={sourceDraft.title} onChange={(event) => setSourceDraft((current) => ({ ...current, title: event.target.value }))} placeholder="title" />
              <input className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={sourceDraft.slug ?? ""} onChange={(event) => setSourceDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="slug" />
              <div className="grid grid-cols-3 gap-2">
                <select className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={sourceDraft.type} onChange={(event) => setSourceDraft((current) => ({ ...current, type: event.target.value as SourceType }))}>
                  {sourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <select className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={sourceDraft.status} onChange={(event) => setSourceDraft((current) => ({ ...current, status: event.target.value as SourceStatus }))}>
                  {sourceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <input className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" type="number" value={sourceDraft.sortOrder} onChange={(event) => setSourceDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} placeholder="sort order" />
              </div>
              <input className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={sourceDraft.coverUrl ?? ""} onChange={(event) => setSourceDraft((current) => ({ ...current, coverUrl: event.target.value }))} placeholder="cover URL" />
              <textarea className="min-h-48 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs" value={metadataDraft} onChange={(event) => setMetadataDraft(event.target.value)} />

              <div className="border-t border-white/10 pt-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-medium">章节 / 关卡</h3>
                  <button className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm" onClick={() => void handleCreateChunk()} type="button">
                    <Plus size={14} />
                    新建 chunk
                  </button>
                </div>
                <div className="space-y-2">
                  {chunks.map((chunk) => (
                    <button key={chunk.id} className={`w-full rounded-md border px-3 py-3 text-left ${chunk.id === selectedChunkId ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-black/20"}`} onClick={() => setSelectedChunkId(chunk.id)} type="button">
                      <div className="flex items-center justify-between gap-2">
                        <span>{chunk.title}</span>
                        <span className="text-xs text-stone-500">{chunk.chapterNum}.{chunk.sectionNum}</span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">{chunk.wordCount} words / {chunk.mapZone}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-stone-500">请选择一个 source。</p>
          )}
        </section>

        <section className="rounded-md border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">章节与句子</h2>
            <div className="flex gap-2">
              <button className="rounded-md border border-white/10 px-3 py-2 text-sm" onClick={() => void handleDeleteChunk()} type="button" disabled={!selectedChunk}>
                <Trash2 size={14} className="inline" /> 删除 chunk
              </button>
              <button className="flex items-center gap-2 rounded-md bg-emerald-300 px-3 py-2 text-sm font-medium text-stone-950" onClick={() => void handleSaveChunk()} type="button" disabled={!selectedChunk}>
                <Save size={14} /> 保存 chunk
              </button>
            </div>
          </div>

          {selectedChunk ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <input className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={chunkDraft.title} onChange={(event) => setChunkDraft((current) => ({ ...current, title: event.target.value }))} placeholder="chunk title" />
                <input className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={chunkDraft.mapZone} onChange={(event) => setChunkDraft((current) => ({ ...current, mapZone: event.target.value }))} placeholder="map zone" />
                <input className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" type="number" value={chunkDraft.chapterNum} onChange={(event) => setChunkDraft((current) => ({ ...current, chapterNum: Number(event.target.value) }))} placeholder="chapter" />
                <input className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" type="number" value={chunkDraft.sectionNum} onChange={(event) => setChunkDraft((current) => ({ ...current, sectionNum: Number(event.target.value) }))} placeholder="section" />
                <input className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" type="number" value={chunkDraft.mapPosX} onChange={(event) => setChunkDraft((current) => ({ ...current, mapPosX: Number(event.target.value) }))} placeholder="mapPosX" />
                <input className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" type="number" value={chunkDraft.mapPosY} onChange={(event) => setChunkDraft((current) => ({ ...current, mapPosY: Number(event.target.value) }))} placeholder="mapPosY" />
              </div>
              <textarea className="min-h-20 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={chunkDraft.summary} onChange={(event) => setChunkDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="summary" />

              <div className="border-t border-white/10 pt-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-medium">Content Nodes</h3>
                  <button className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm" onClick={() => void handleCreateNode()} type="button">
                    <UploadCloud size={14} />
                    新增句子
                  </button>
                </div>
                <div className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3">
                  <input className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" type="number" value={nodeDraft.sequence} onChange={(event) => setNodeDraft((current) => ({ ...current, sequence: Number(event.target.value) }))} placeholder="sequence" />
                  <textarea className="min-h-20 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={nodeDraft.rawText} onChange={(event) => setNodeDraft((current) => ({ ...current, rawText: event.target.value }))} placeholder="raw text" />
                  <textarea className="min-h-16 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={nodeDraft.cleanText} onChange={(event) => setNodeDraft((current) => ({ ...current, cleanText: event.target.value }))} placeholder="clean text" />
                  <textarea className="min-h-16 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={nodeDraft.translation} onChange={(event) => setNodeDraft((current) => ({ ...current, translation: event.target.value }))} placeholder="translation" />
                </div>
                <div className="mt-3 space-y-3">
                  {nodes.map((node) => (
                    <NodeCard key={node.id} node={node} onSave={handleUpdateNode} onDelete={handleDeleteNode} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-stone-500">请选择一个 chunk。</p>
          )}
        </section>
      </section>
    </main>
  );
}

function NodeCard({ node, onSave, onDelete }: { node: ContentNode; onSave: (node: ContentNode) => Promise<void>; onDelete: (nodeId: string) => Promise<void> }) {
  const [draft, setDraft] = useState(node);

  useEffect(() => {
    setDraft(node);
  }, [node]);

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Node #{draft.sequence}</span>
        <div className="flex gap-2">
          <button className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs" onClick={() => void onSave(draft)} type="button">
            <PencilLine size={12} /> 保存
          </button>
          <button className="rounded-md border border-rose-400/20 px-2 py-1 text-xs text-rose-100" onClick={() => void onDelete(draft.id)} type="button">删除</button>
        </div>
      </div>
      <div className="grid gap-2">
        <input className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" type="number" value={draft.sequence} onChange={(event) => setDraft((current) => ({ ...current, sequence: Number(event.target.value) }))} />
        <textarea className="min-h-20 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={draft.rawText} onChange={(event) => setDraft((current) => ({ ...current, rawText: event.target.value }))} />
        <textarea className="min-h-16 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={draft.cleanText} onChange={(event) => setDraft((current) => ({ ...current, cleanText: event.target.value }))} />
        <textarea className="min-h-16 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm" value={draft.translation ?? ""} onChange={(event) => setDraft((current) => ({ ...current, translation: event.target.value }))} />
      </div>
    </div>
  );
}
