import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, clients, user } from "@/db/schema";
import { formatAppointment } from "@/lib/dates";
import { sendClinicEmail } from "@/lib/email";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Unauthorized", { status: 401 });
  const now = new Date(); const from = new Date(now.getTime() + 23 * 60 * 60 * 1000); const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const due = await db.select({ id: appointments.id, clinicId: appointments.clinicId, startsAt: appointments.startsAt, parentEmail: clients.parentEmail, therapistEmail: user.email }).from(appointments).innerJoin(clients, eq(clients.id, appointments.clientId)).innerJoin(user, eq(user.id, appointments.therapistUserId)).where(and(eq(appointments.status, "scheduled"), isNull(appointments.reminderSentAt), gte(appointments.startsAt, from), lt(appointments.startsAt, to)));
  for (const item of due) {
    const message = `You have a speech therapy appointment ${formatAppointment(item.startsAt)}. Sign in for details.`;
    await Promise.all([item.parentEmail, item.therapistEmail].map((to) => sendClinicEmail({ clinicId: item.clinicId, to, kind: "appointment_reminder", subject: "Appointment reminder", message, actionUrl: `${process.env.BETTER_AUTH_URL}/calendar`, actionLabel: "View appointment" })));
    await db.update(appointments).set({ reminderSentAt: new Date() }).where(eq(appointments.id, item.id));
  }
  return NextResponse.json({ reminded: due.length });
}
