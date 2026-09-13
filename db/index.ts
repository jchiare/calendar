import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgresql://demo:demo@localhost/demo";
export const db = drizzle(neon(url), { schema });
