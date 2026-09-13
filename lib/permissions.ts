import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clinics, member, type Role } from "@/db/schema";
import { getSession } from "./auth";
import { isDemoMode } from "./env";
import { ApiError } from "./api";

export type Actor = { userId: string; clinicId: string; organizationId: string; role: Role; name: string; email: string };
export const demoActor: Actor = { userId: "demo-therapist", clinicId: "00000000-0000-4000-8000-000000000001", organizationId: "demo-org", role: "therapist", name: "Alex Johnson", email: "alex@sayso.demo" };

export async function requireRole(allowed: Role[]): Promise<Actor> {
  if (isDemoMode) return demoActor;
  const session = await getSession();
  if (!session) throw new ApiError(401, "Authentication required");
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) throw new ApiError(403, "Select a clinic organization");
  const [result] = await db.select({ role: member.role, clinicId: clinics.id }).from(member).innerJoin(clinics, eq(clinics.organizationId, member.organizationId)).where(and(eq(member.userId, session.user.id), eq(member.organizationId, organizationId))).limit(1);
  if (!result || !allowed.includes(result.role as Role)) throw new ApiError(403, "You do not have permission to perform this action");
  return { userId: session.user.id, clinicId: result.clinicId, organizationId, role: result.role as Role, name: session.user.name, email: session.user.email };
}

export function scopeClient(actor: Actor) {
  if (actor.role === "therapist") return { therapistUserId: actor.userId };
  if (actor.role === "parent") return { parentUserId: actor.userId };
  return {};
}
