import { db } from "@/db";
import { appointments, progress } from "@/db/schema";
import { apiError } from "@/lib/api";
import { sendClinicEmail } from "@/lib/email";
import { requireRole } from "@/lib/permissions";
import { requireAppointmentAccess } from "@/lib/resource-access";
import { eq } from "drizzle-orm";
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
    if (input.progress.length)
      await db.insert(progress).values(
        input.progress.map((item) => ({
          ...item,
          clinicId: actor.clinicId,
          appointmentId: id,
        })),
      );
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
