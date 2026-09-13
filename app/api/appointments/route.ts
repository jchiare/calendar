import { db } from "@/db";
import { appointments, user } from "@/db/schema";
import { apiError, ApiError } from "@/lib/api";
import { addWeeks } from "@/lib/dates";
import { sendClinicEmail } from "@/lib/email";
import { requireRole } from "@/lib/permissions";
import { requireClientAccess } from "@/lib/resource-access";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const inputSchema = z.object({
  clientId: z.uuid(),
  therapistUserId: z.string().min(1),
  startsAt: z.coerce.date(),
  minutes: z.number().int().min(15).max(120),
  repeatWeeks: z.number().int().min(1).max(52).default(1),
});
export async function POST(request: Request) {
  try {
    const actor = await requireRole(["admin", "therapist", "parent"]);
    const input = inputSchema.parse(await request.json());
    const client = await requireClientAccess(actor, input.clientId);
    if (actor.role === "parent" && input.therapistUserId !== client.therapistUserId)
      throw new ApiError(403, "Parents may only book with the assigned therapist");
    const created = [];
    for (let week = 0; week < input.repeatWeeks; week++) {
      const [appointment] = await db
        .insert(appointments)
        .values({
          clinicId: actor.clinicId,
          clientId: input.clientId,
          therapistUserId: input.therapistUserId,
          startsAt: addWeeks(input.startsAt, week),
          minutes: input.minutes,
        })
        .returning();
      created.push(appointment);
    }
    const [therapist] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, input.therapistUserId))
      .limit(1);
    const message =
      "A new speech therapy appointment is available in your Sayso schedule.";
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    await Promise.all(
      [client.parentEmail, therapist?.email]
        .filter((email): email is string => Boolean(email))
        .map((to) =>
          sendClinicEmail({
            clinicId: actor.clinicId,
            to,
            kind: "appointment_booked",
            subject: "A speech therapy appointment was booked",
            message,
            actionUrl: `${base}/calendar`,
            actionLabel: "View appointment",
          }),
        ),
    );
    return NextResponse.json({ appointments: created }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
