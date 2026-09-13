# Sayso

Sayso is a focused speech-therapy clinic workspace for scheduling, session documentation, parent communication, and therapist-reviewed AI assistance.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Managed stack

- Next.js 16 on Vercel, with Vercel Blob and hourly Vercel Cron
- Neon Postgres through Drizzle ORM
- Better Auth email/password accounts and organization roles
- OpenRouter through the OpenAI SDK for every AI task
- Resend and React Email for transactional messages
- `unpdf` for text-first IEP extraction with a scanned-page fallback

Copy `.env.example` to `.env.local`, configure the managed services, then initialize the schema:

```bash
npm run db:push
```

Without `DATABASE_URL`, the UI opens in demo mode so the clinic workflow can be reviewed locally. AI, upload, email, and persistence routes require their corresponding managed-service credentials.

## HTTP API

All application mutations use App Router route handlers and JSON or multipart requests—there are no Server Actions. The primary endpoints are:

- `POST /api/clients` and `PATCH /api/clients/:id/intake`
- `POST /api/clients/:id/goals`
- `POST /api/availability`
- `POST /api/appointments` and `PATCH /api/appointments/:id`
- `PUT /api/appointments/:id/session` and `PUT /api/appointments/:id/plan`
- `POST /api/documents` and `POST /api/ai/:task`

Each mutation resolves the Better Auth session, verifies the member role and clinic, validates the request with Zod, and returns JSON errors with an appropriate HTTP status.
