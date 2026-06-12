# Typinglish 字里行间

Typinglish is an English typing trainer that combines typing speed, muscle memory and high-value English content.

## Implemented Surface

- PostgreSQL DDL in `db/schema.sql`
- Node/Express API matching the design document:
  - `GET /api/v1/sources`
  - `GET /api/v1/sources/:id/map`
  - `GET /api/v1/chunks/:id/stream`
  - `POST /api/v1/progress/report`
- In-memory demo repository for local startup without PostgreSQL
- Optional PostgreSQL repository when `DATABASE_URL` is provided
- SRT import script that creates `sources`, `chunks` and `content_nodes`
- React + Zustand frontend with:
  - strict and tolerant typing modes
  - adventure map with dependency locks and star settlement
  - Zen mode with a three-line typing viewport and local bookmarks

## Run

```bash
npm install
npm run api
npm run dev
```

Open `http://127.0.0.1:5173`.

## PostgreSQL

Apply the schema:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Run the API with PostgreSQL:

```bash
$env:DATABASE_URL="postgres://user:password@localhost:5432/typinglish"
npm run api
```

## Import SRT

Dry run:

```bash
npm run import:srt -- --file ./sample.srt --title "Friends S01E01" --dry-run
```

Write to PostgreSQL:

```bash
$env:DATABASE_URL="postgres://user:password@localhost:5432/typinglish"
npm run import:srt -- --file ./sample.srt --title "Friends S01E01" --section-size 20
```
