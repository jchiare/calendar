import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clients, clinics, member } from "@/db/schema";
import { ApiError } from "./api";
import type { Actor } from "./permissions";

export async function requireClientAccess(actor: Actor, clientId: string) {
  const conditions = [eq(clients.id, clientId), eq(clients.clinicId, actor.clinicId)];
  if (actor.role === "therapist")
    conditions.push(eq(clients.therapistUserId, actor.userId));
  if (actor.role === "parent") conditions.push(eq(clients.parentUserId, actor.userId));
  const [client] = await db
    .select()
    .from(clients)
    .where(and(...conditions))
    .limit(1);
  if (!client) throw new ApiError(404, "Client not found");
  return client;
}

export async function requireAppointmentAccess(actor: Actor, appointmentId: string) {
  const conditions = [
    eq(appointments.id, appointmentId),
    eq(appointments.clinicId, actor.clinicId),
  ];
  if (actor.role === "therapist")
    conditions.push(eq(appointments.therapistUserId, actor.userId));
  const [row] = await db
    .select({ appointment: appointments, client: clients })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(and(...conditions))
    .limit(1);
  if (!row || (actor.role === "parent" && row.client.parentUserId !== actor.userId))
    throw new ApiError(404, "Appointment not found");
  return row;
}

export async function requireClinicTherapist(actor: Actor, therapistUserId: string) {
  const [therapist] = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      and(
        eq(member.organizationId, actor.organizationId),
        eq(member.userId, therapistUserId),
        inArray(member.role, ["admin", "therapist"]),
      ),
    )
    .limit(1);
  if (!therapist) throw new ApiError(400, "Therapist is not a member of this clinic");
}

export async function getClinicTimezone(clinicId: string) {
  const [clinic] = await db
    .select({ timezone: clinics.timezone })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);
  if (!clinic) throw new ApiError(404, "Clinic not found");
  return clinic.timezone;
}
