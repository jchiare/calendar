import { db } from "@/db";
import { goals } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { requireClientAccess } from "@/lib/resource-access";
import { NextResponse } from "next/server";
import { z } from "zod";

const goalSchema = z.object({ domain: z.string().trim().min(1), text: z.string().trim().min(1), baseline: z.string().optional(), criterion: z.string().optional(), keep: z.boolean() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const actor = await requireRole(["admin", "therapist"]); const clientId = z.uuid().parse((await params).id); await requireClientAccess(actor, clientId); const selected = z.object({ goals: z.array(goalSchema) }).parse(await request.json()).goals.filter((goal) => goal.keep); const created = selected.length ? await db.insert(goals).values(selected.map((goal) => ({ clinicId: actor.clinicId, clientId, domain: goal.domain, text: goal.text, baseline: goal.baseline, criterion: goal.criterion }))).returning() : []; return NextResponse.json({ goals: created }, { status: 201 }); } catch (error) { return apiError(error); }
}
