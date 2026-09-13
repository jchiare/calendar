import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clients } from "@/db/schema";
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
