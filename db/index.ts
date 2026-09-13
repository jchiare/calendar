import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Vercel's import form can save an empty value. Treat it the same as an unset
// variable so builds can still render the read-only demo instead of failing
// while Next.js collects route metadata.
const url = process.env.DATABASE_URL?.trim() || "postgresql://demo:demo@localhost/demo";
export const db = drizzle(neon(url), { schema });
