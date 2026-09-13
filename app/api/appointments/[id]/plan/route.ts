import { db } from "@/db";
import { appointments } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { requireAppointmentAccess } from "@/lib/resource-access";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const actor = await requireRole(["admin", "therapist"]); const id = z.uuid().parse((await params).id); await requireAppointmentAccess(actor, id); const { planText } = z.object({ planText: z.string().trim().min(3) }).parse(await request.json()); const [appointment] = await db.update(appointments).set({ planText, updatedAt: new Date() }).where(eq(appointments.id, id)).returning(); return NextResponse.json({ appointment }); } catch (error) { return apiError(error); } }
