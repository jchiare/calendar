import { db } from "@/db";
import { appointments, goals, progress } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { sendClinicEmail } from "@/lib/email";
import { requireRole } from "@/lib/permissions";
import { requireAppointmentAccess } from "@/lib/resource-access";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRole(["admin", "therapist"]);
    const id = z.uuid().parse((await params).id);
    const row = await requireAppointmentAccess(actor, id);
    const input = z
      .object({
        noteText: z.string().trim().min(3),
        parentSummaryText: z.string().trim().min(3),
        progress: z.array(
          z.object({
            goalId: z.uuid(),
            rating: z.number().int().min(1).max(5),
            comment: z.string().optional(),
          }),
        ),
      })
      .parse(await request.json());
    const goalIds = [...new Set(input.progress.map((item) => item.goalId))];
    if (goalIds.length !== input.progress.length)
      throw new ApiError(400, "Rate each goal at most once");
    if (goalIds.length) {
      const clientGoals = await db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.clientId, row.client.id), inArray(goals.id, goalIds)));
      if (clientGoals.length !== goalIds.length)
        throw new ApiError(400, "Progress may only be recorded for this client's goals");
    }
    const [appointment] = await db
      .update(appointments)
      .set({
        noteText: input.noteText,
        parentSummaryText: input.parentSummaryText,
        status: "done",
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();
    // Saving the session again replaces the earlier ratings instead of failing
    // on the one-rating-per-goal-per-appointment index.
    if (input.progress.length)
      await db
        .insert(progress)
        .values(
          input.progress.map((item) => ({
            ...item,
            clinicId: actor.clinicId,
            appointmentId: id,
          })),
        )
        .onConflictDoUpdate({
          target: [progress.goalId, progress.appointmentId],
          set: {
            rating: sql`excluded.rating`,
            comment: sql`excluded.comment`,
          },
        });
    await sendClinicEmail({
      clinicId: actor.clinicId,
      to: row.client.parentEmail,
      kind: "session_summary_ready",
      subject: "A session summary is ready",
      message: "Your therapist saved a new session update. Sign in to read it securely.",
      actionUrl: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/portal`,
      actionLabel: "Read summary",
    });
    return NextResponse.json({ appointment }, { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}
