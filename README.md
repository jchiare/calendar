# Calendar

A Next.js 16 + Tailwind + Convex starter for a family-focused calendar with AI-assisted scheduling.

## Getting Started

```bash
npm install
npm run dev
```

## Convex

```bash
npx convex dev
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
