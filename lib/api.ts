import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isDemoMode } from "./env";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Invalid request", issues: error.issues },
      { status: 400 },
    );
  console.error(error);
  // The demo has no database, so writes fail on the placeholder connection.
  if (isDemoMode)
    return NextResponse.json(
      { error: "This is the read-only demo. Connect DATABASE_URL to save changes." },
      { status: 503 },
    );
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Internal server error" },
    { status: 500 },
  );
}
