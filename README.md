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
- OpenAI models through OpenRouter and the OpenAI SDK for every AI task
- Resend and React Email for transactional messages
- `unpdf` for text-first IEP extraction with a scanned-page fallback

Copy `.env.example` to `.env.local`, configure the managed services, then initialize the schema:

```bash
npm run db:push
```

Without `DATABASE_URL`, the UI opens in demo mode so the clinic workflow can be reviewed locally. AI, upload, email, and persistence routes require their corresponding managed-service credentials.

## Deploy to Vercel

The project can be deployed from the repository root with the **Next.js** preset.
Leave the Build, Output, and Install command overrides empty so Vercel uses the
commands from `package.json`.

### Start with no environment variables

You only need to obtain three values for a persistent deployment. Do not invent
or leave blank placeholder values in Vercel:

1. **Get `DATABASE_URL` from Neon:** on the Vercel import page, select
   **Neon → Add Integration**, create a database, and connect it to this project.
   Vercel adds `DATABASE_URL` automatically. You can also create a database at
   Neon, copy its pooled connection string, and paste it into **Project Settings
   → Environment Variables** as `DATABASE_URL`.
2. **Generate `BETTER_AUTH_SECRET`:** run this locally and paste its output into
   Vercel as `BETTER_AUTH_SECRET`:

   ```bash
   openssl rand -base64 32
   ```

   Generate this once, keep it private, and use the same value across production
   redeployments. Do not commit the generated value.

3. **Set `BETTER_AUTH_URL`:** use the public URL Vercel assigns the project, for
   example `https://calendar.vercel.app`, with no trailing slash. If you do not
   know the URL yet, make an initial demo deployment without `DATABASE_URL`, copy
   the URL from the deployment, add all three variables in **Project Settings →
   Environment Variables**, and redeploy.

Select **Production, Preview, and Development** for these values if you want all
deployments to share the database. For better isolation, give Preview a separate
Neon database or branch. At minimum, Production must be selected.

### Optional features

The application deploys without these values, but the corresponding features
remain disabled:

- **AI:** create an OpenRouter API key and save it as `OPENROUTER_API_KEY`. The
  three `OPENROUTER_*_MODEL` values in `.env.example` are optional overrides.
- **Email:** create a Resend API key as `RESEND_API_KEY`. After verifying a sender
  domain in Resend, set `EMAIL_FROM` to a sender on that domain, such as
  `Sayso <notifications@example.com>`.
- **Uploads:** open the Vercel project's **Storage** tab, create a **Blob** store,
  and connect it to the project. Vercel creates `BLOB_READ_WRITE_TOKEN`.
- **Reminders:** generate another random value with `openssl rand -hex 32` and
  save it as `CRON_SECRET`. Vercel uses it to authenticate the configured cron.

After adding an environment variable, redeploy: values are only applied to new
deployments. Never paste secrets into the repository or commit `.env.local`.

### Initialize and verify

Deploy once with the three required values, then initialize the Neon schema from
a trusted local checkout:

```bash
npx vercel link
npx vercel env pull .env.local
npm run db:push
```

Redeploy from Vercel, then verify `/sign-in` and the authenticated workflow.

For the error `No database connection string was provided to neon()`, return to
the import screen and either provision Neon or remove the blank `DATABASE_URL`
row. A real deployment needs the Neon URL; removing the blank row only permits
the read-only demo build.

## HTTP API

All application mutations use App Router route handlers and JSON or multipart requests—there are no Server Actions. The primary endpoints are:

- `POST /api/clients` and `PATCH /api/clients/:id/intake`
- `POST /api/clients/:id/goals`
- `POST /api/availability`
- `POST /api/appointments` and `PATCH /api/appointments/:id`
- `PUT /api/appointments/:id/session` and `PUT /api/appointments/:id/plan`
- `POST /api/documents` and `POST /api/ai/:task`

Each mutation resolves the Better Auth session, verifies the member role and clinic, validates the request with Zod, and returns JSON errors with an appropriate HTTP status.
