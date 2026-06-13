import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

interface CliOptions {
  file: string;
  slug: string;
  title: string;
  type: "SERIES" | "BOOK" | "VOCAB";
  chapter: number;
  sectionSize: number;
  metadata: Record<string, unknown>;
  coverUrl: string | null;
  dryRun: boolean;
}

interface SubtitleBlock {
  index: number;
  text: string;
}

function getArg(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseMetadata(raw: string | undefined) {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--metadata must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function parseOptions(): CliOptions {
  const file = getArg("file");
  if (!file) {
    throw new Error(
      'Usage: npm run import:srt -- --file ./sample.srt --title "Source Title" [--slug source-slug] [--metadata "{\"level\":\"B1\"}"] [--dry-run]'
    );
  }

  const title = getArg("title", path.basename(file, path.extname(file)))!;
  const slug = getArg("slug", slugify(title))!;
  if (!slug) {
    throw new Error("A valid slug is required.");
  }

  return {
    file,
    slug,
    title,
    type: (getArg("type", "SERIES") as CliOptions["type"]) ?? "SERIES",
    chapter: Number(getArg("chapter", "1")),
    sectionSize: Number(getArg("section-size", "20")),
    metadata: parseMetadata(getArg("metadata")),
    coverUrl: getArg("cover-url") ?? null,
    dryRun: process.argv.includes("--dry-run")
  };
}

function stripBom(text: string) {
  return text.replace(/^﻿/, "");
}

function cleanLine(line: string) {
  return line
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]+\}/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanForCompare(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}'.,!?;:\-\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSrt(raw: string): SubtitleBlock[] {
  return stripBom(raw)
    .split(/\r?\n\r?\n+/)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
    .map((lines) => {
      const index = Number(lines[0]);
      const textLines = lines.filter((line) => !/^\d+$/.test(line) && !line.includes("-->"));
      const text = cleanLine(textLines.join(" "));
      return { index: Number.isFinite(index) ? index : 0, text };
    })
    .filter((block) => block.text.length > 0);
}

async function insertIntoPostgres(options: CliOptions, blocks: SubtitleBlock[]) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required unless --dry-run is used.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const sourceResult = await client.query<{ id: string }>(
      `
      INSERT INTO sources (slug, title, type, cover_url, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        type = EXCLUDED.type,
        cover_url = COALESCE(EXCLUDED.cover_url, sources.cover_url),
        metadata = sources.metadata || EXCLUDED.metadata,
        is_active = true
      RETURNING id
      `,
      [
        options.slug,
        options.title,
        options.type,
        options.coverUrl,
        {
          ...options.metadata,
          importedFrom: options.file,
          importer: "server/scripts/import-srt.ts"
        }
      ]
    );
    const sourceId = sourceResult.rows[0].id;

    let previousChunkId: string | null = null;
    for (let offset = 0; offset < blocks.length; offset += options.sectionSize) {
      const sectionBlocks = blocks.slice(offset, offset + options.sectionSize);
      const sectionNum = Math.floor(offset / options.sectionSize) + 1;
      const wordCount = sectionBlocks.reduce((sum, block) => sum + block.text.split(/\s+/).length, 0);
      const dependencies: string[] = previousChunkId ? [previousChunkId] : [];
      const chunkResult: pg.QueryResult<{ id: string }> = await client.query<{ id: string }>(
        `
        INSERT INTO chunks (
          source_id, chapter_num, section_num, title, dependencies, map_zone, map_pos_x, map_pos_y, word_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (source_id, chapter_num, section_num) DO UPDATE SET
          title = EXCLUDED.title,
          dependencies = EXCLUDED.dependencies,
          map_zone = EXCLUDED.map_zone,
          map_pos_x = EXCLUDED.map_pos_x,
          map_pos_y = EXCLUDED.map_pos_y,
          word_count = EXCLUDED.word_count
        RETURNING id
        `,
        [
          sourceId,
          options.chapter,
          sectionNum,
          `${options.title} ${sectionNum}`,
          dependencies,
          "imported",
          sectionNum % 2 === 0 ? 1 : -1,
          sectionNum - 1,
          wordCount
        ]
      );
      const chunkId: string = chunkResult.rows[0].id;
      previousChunkId = chunkId;

      for (let index = 0; index < sectionBlocks.length; index += 1) {
        const block = sectionBlocks[index];
        await client.query(
          `
          INSERT INTO content_nodes (chunk_id, sequence, raw_text, clean_text, translation, audio_url)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (chunk_id, sequence) DO UPDATE SET
            raw_text = EXCLUDED.raw_text,
            clean_text = EXCLUDED.clean_text,
            translation = EXCLUDED.translation,
            audio_url = EXCLUDED.audio_url
          `,
          [chunkId, index + 1, block.text, cleanForCompare(block.text), null, null]
        );
      }

      await client.query("DELETE FROM content_nodes WHERE chunk_id = $1 AND sequence > $2", [chunkId, sectionBlocks.length]);
    }

    await client.query(
      `
      DELETE FROM chunks
      WHERE source_id = $1
        AND chapter_num = $2
        AND section_num > $3
      `,
      [sourceId, options.chapter, Math.ceil(blocks.length / options.sectionSize)]
    );

    await client.query("COMMIT");
    console.log(`Synced ${blocks.length} subtitle blocks into source ${sourceId} (${options.slug}).`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const options = parseOptions();
  const raw = await fs.readFile(options.file, "utf8");
  const blocks = parseSrt(raw);

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          source: { slug: options.slug, title: options.title, type: options.type, metadata: options.metadata },
          chunks: Math.ceil(blocks.length / options.sectionSize),
          nodes: blocks.slice(0, 5).map((block, index) => ({
            sequence: index + 1,
            raw_text: block.text,
            clean_text: cleanForCompare(block.text)
          }))
        },
        null,
        2
      )
    );
    return;
  }

  await insertIntoPostgres(options, blocks);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
