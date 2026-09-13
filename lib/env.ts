import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export const env = schema.parse(process.env);
export const isDemoMode = !env.DATABASE_URL;
