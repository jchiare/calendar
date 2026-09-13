import { db } from "@/db";
import { appointments, user } from "@/db/schema";
import { apiError } from "@/lib/api";
import { sendClinicEmail } from "@/lib/email";
import { requireRole } from "@/lib/permissions";
import { requireAppointmentAccess } from "@/lib/resource-access";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRole(["admin", "therapist", "parent"]);
    const id = z.uuid().parse((await params).id);
    const row = await requireAppointmentAccess(actor, id);
    const { status } = z
      .object({ status: z.literal("cancelled") })
      .parse(await request.json());
    const [appointment] = await db
      .update(appointments)
      .set({ status, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    const [therapist] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, row.appointment.therapistUserId))
      .limit(1);
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    await Promise.all(
      [row.client.parentEmail, therapist?.email]
        .filter((email): email is string => Boolean(email))
        .map((to) =>
          sendClinicEmail({
            clinicId: actor.clinicId,
            to,
            kind: "appointment_cancelled",
            subject: "A speech therapy appointment was cancelled",
            message:
              "An appointment has been cancelled. Sign in to review the updated schedule.",
            actionUrl: `${base}/calendar`,
            actionLabel: "View schedule",
          }),
        ),
    );
    return NextResponse.json({ appointment });
  } catch (error) {
    return apiError(error);
  }
}
