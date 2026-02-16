# Calendar

A Next.js 16 + Tailwind + Convex starter for a family-focused calendar with AI-assisted scheduling.

## Product Vision

An AI-first household tool that plans, schedules, and proactively helps before issues happen. It should coordinate multiple people in one home, warn about risks (like unusual traffic before appointments), and surface opportunities (like cheaper travel during unexpected free time).

## Household Onboarding (Proposed)

1. Create one household workspace and timezone.
2. Invite household members and assign roles.
3. Connect each member calendar (or use local Convex calendars first).
4. Set AI guardrails (confirm-first vs auto-add, edit permissions, notification rules).
5. Run an initial "week setup" pass to import routines and resolve conflicts.

## Onboarding Seed Data

- The app now supports idempotent onboarding seed data for a multi-person household.
- `/calendar` will auto-bootstrap a default household if none exists.
- `/admin` includes a **Seed onboarding data** button you can run any time.

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
- If no household workspace exists, `/calendar` auto-runs onboarding seed data.

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
