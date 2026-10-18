import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, clients, clinics, user } from "@/db/schema";
import { formatAppointment } from "@/lib/dates";
import { sendClinicEmail } from "@/lib/email";

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new NextResponse("Unauthorized", { status: 401 });
  // The cron runs once a day (the most Vercel Hobby allows), so each run covers
  // everything in the next 36 hours that has not been reminded yet.
  const now = new Date();
  const to = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const due = await db
    .select({
      id: appointments.id,
      clinicId: appointments.clinicId,
      startsAt: appointments.startsAt,
      timeZone: clinics.timezone,
      parentEmail: clients.parentEmail,
      therapistEmail: user.email,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(user, eq(user.id, appointments.therapistUserId))
    .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
    .where(
      and(
        eq(appointments.status, "scheduled"),
        isNull(appointments.reminderSentAt),
        gte(appointments.startsAt, now),
        lt(appointments.startsAt, to),
      ),
    );
  let failed = 0;
  for (const item of due) {
    const message = `You have a speech therapy appointment ${formatAppointment(item.startsAt, item.timeZone)}. Sign in for details.`;
    const results = await Promise.allSettled(
      [item.parentEmail, item.therapistEmail].map((to) =>
        sendClinicEmail({
          clinicId: item.clinicId,
          to,
          kind: "appointment_reminder",
          subject: "Appointment reminder",
          message,
          actionUrl: `${base}/calendar`,
          actionLabel: "View appointment",
        }),
      ),
    );
    // Leave the appointment unmarked so the next run retries a failed send.
    if (results.some((result) => result.status === "rejected")) {
      failed++;
      console.error(`Reminder for appointment ${item.id} failed`, results);
      continue;
    }
    await db
      .update(appointments)
      .set({ reminderSentAt: new Date() })
      .where(eq(appointments.id, item.id));
  }
  return NextResponse.json({ reminded: due.length - failed, failed });
}
