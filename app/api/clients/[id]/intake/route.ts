import { db } from "@/db";
import { clients } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { requireClientAccess } from "@/lib/resource-access";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const actor = await requireRole(["admin", "therapist", "parent"]); const id = z.uuid().parse((await params).id); await requireClientAccess(actor, id); const input = z.object({ concerns: z.string().trim().min(3), homeLanguages: z.string().trim().min(2), consent: z.literal(true) }).parse(await request.json()); const [client] = await db.update(clients).set({ ...input, updatedAt: new Date() }).where(eq(clients.id, id)).returning(); return NextResponse.json({ client }); } catch (error) { return apiError(error); }
}
