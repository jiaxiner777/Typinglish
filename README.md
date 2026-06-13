# Typinglish 字里行间

Typinglish is an English typing trainer for learners who want to improve **typing speed**, **English sentence muscle memory**, and **content-based practice** at the same time.

Instead of isolated word drills, Typinglish is built around **playable levels**, **readable book-style content**, and a **database-backed content pipeline** so the learning material can keep growing over time.

## What you can do

### Public experience
- **Adventure mode** — progress through level-based typing challenges
- **Zen mode** — practice with longer reading-style content
- **Strict / tolerant input modes** — switch between different typing feedback styles
- **PostgreSQL-backed progress** — content and user progress come from the database, not hardcoded frontend data

### Built-in content management
- Manage **sources** (books / series / vocab packs)
- Manage **chunks** (chapters / levels)
- Manage **content nodes** (individual lines / sentences)
- Publish or archive content
- Seed demo content or import new subtitle content through the backend pipeline

## Project structure

This repository now follows a split web architecture:

- **Frontend**: Vite + React
- **Backend**: Express API
- **Database**: PostgreSQL

The old Go desktop packaging path has been archived under [archive/go-desktop/](archive/go-desktop/) and is no longer part of the main development flow.

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local environment file

```bash
cp .env.example .env
```

Typical example:

```env
NODE_ENV=development
PORT=4177
DATABASE_URL=postgres://typinglish_user:password@127.0.0.1:5432/typinglish
CORS_ORIGIN=http://127.0.0.1:5173
VITE_API_BASE_URL=http://127.0.0.1:4177
ADMIN_TOKEN=
VITE_ADMIN_TOKEN=
DEMO_USER_ID=00000000-0000-4000-8000-000000000001
```

If you enable `ADMIN_TOKEN`, the admin frontend must send the same value through `VITE_ADMIN_TOKEN`.

### 3. Apply the database schema

```bash
node --env-file-if-exists=.env --input-type=module -e "import fs from 'node:fs/promises'; import pg from 'pg'; const sql = await fs.readFile('db/schema.sql', 'utf8'); const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect(); await client.query(sql); await client.end(); console.log('schema applied');"
```

### 4. Seed demo content

```bash
npm run seed:demo
```

This writes the built-in books, levels, and nodes into PostgreSQL so the app is immediately usable.

### 5. Start the app

Run backend and frontend in separate terminals:

```bash
npm run api
npm run dev
```

Open:

- Public app: `http://127.0.0.1:5173/`
- Admin console: `http://127.0.0.1:5173/admin`

## How content works

Typinglish uses PostgreSQL as the main content source.

That means:
- public levels are read from the database
- Zen reading content is read from the database
- user progress is written back to the database
- new content should be added through:
  - `npm run seed:demo`
  - `npm run import:srt`
  - the admin console / admin API

If the frontend loads but appears empty, the first thing to check is whether PostgreSQL already contains content.

## Importing more content

### Dry run

```bash
npm run import:srt -- --file ./sample.srt --title "Friends S01E01" --slug friends-s01e01 --dry-run
```

### Write into PostgreSQL

```bash
npm run import:srt -- \
  --file ./sample.srt \
  --title "Friends S01E01" \
  --slug friends-s01e01 \
  --type SERIES \
  --section-size 20 \
  --metadata '{"level":"B1","genre":"sitcom"}'
```

The importer upserts by:
- `sources.slug`
- `(source_id, chapter_num, section_num)` for chunks
- `(chunk_id, sequence)` for content nodes

## Repository layout

```text
src/                  frontend app
  app/public/         public gameplay app
  app/admin/          admin content console
  api/                frontend API clients
server/               express backend
  app/                app bootstrap
  config/             env parsing
  routes/             public/admin routes
  scripts/            import + seed scripts
db/                   PostgreSQL schema
archive/go-desktop/   archived legacy Go desktop path
```

## Verification

### Health check

```bash
curl http://127.0.0.1:4177/api/v1/health
```

Healthy PostgreSQL-backed response:

```json
{"ok":true,"mode":"postgres","architecture":"split","database":{"configured":true,"ok":true}}
```

### Sources API

```bash
curl http://127.0.0.1:4177/api/v1/sources
```

## Developer commands

Typecheck:

```bash
npm run check
```

Build:

```bash
npm run build
```

Run compiled backend:

```bash
npm run start
```

## Current status

Typinglish already supports:
- PostgreSQL-backed content and progress
- public gameplay flows
- built-in admin content management
- demo seeding and SRT import

The current direction is to continue expanding:
- more levels and reading content
- better admin editing workflows
- fuller user account/auth flows
- stronger publishing/content operations
