# Calendar

A Next.js 16 + Tailwind + Convex starter for a family-focused calendar with AI-assisted scheduling.

## Prerequisites

- Node.js 24.13.0 (latest v24 LTS line; see `.nvmrc`)

## Getting Started

```bash
nvm use
npm install
npm run dev
```

## Convex

```bash
npm run convex:dev
```

## Environment

- `NEXT_PUBLIC_CONVEX_URL` is required for live Convex data in the UI.
- `OPENAI_API_KEY` is optional; if missing, AI falls back to regex parsing.
- `NEXT_PUBLIC_ENABLE_DEMO_SEED=true` (optional, development-only) enables auto-seeding demo events when the database is empty.

## Quality Checks

```bash
npm run typecheck
npm run check
```

## Architecture decisions

- Convex Auth for a simpler stack and fewer moving parts.
- Webhook + sync queue pattern for robust Google Calendar sync.
- Explicit conflict resolution UI to avoid losing edits.
- Apple Calendar (CalDAV) deferred until later.

## Project Structure

- `app/` - Next.js App Router pages
- `convex/` - Convex schema and functions
- `PLAN.md` - Product plan and scope

### Routes

- `/` landing page
- `/calendar` calendar workspace
- `/admin` admin console
