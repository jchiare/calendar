import { db } from "@/db";
import { availability } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: Request) { try { const actor = await requireRole(["admin", "therapist"]); const input = z.object({ weekday: z.number().int().min(0).max(6), startTime: z.string().regex(/^\d\d:\d\d$/), endTime: z.string().regex(/^\d\d:\d\d$/), therapistUserId: z.string().optional() }).parse(await request.json()); const therapistUserId = actor.role === "admin" && input.therapistUserId ? input.therapistUserId : actor.userId; const [hours] = await db.insert(availability).values({ clinicId: actor.clinicId, therapistUserId, weekday: input.weekday, startTime: input.startTime, endTime: input.endTime }).returning(); return NextResponse.json({ availability: hours }, { status: 201 }); } catch (error) { return apiError(error); } }
