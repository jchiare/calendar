# Convex Functions

This folder contains schema and server functions for the calendar app.

## Run Locally

From the project root:

```bash
npm run convex:dev
```

## Files

- `schema.ts` defines tables and indexes.
- `events.ts` handles calendar event queries/mutations.
- `ai.ts` parses AI requests and dispatches event creation.
- `aiMutations.ts` contains internal AI-only write mutations.
- `eventValidation.ts` centralizes event validation rules.

## Notes

- All event writes share validation through `eventValidation.ts`.
- Week/today reads include overlapping events (not only events starting in-range).
