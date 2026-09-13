import { db } from "@/db";
import { clients } from "@/db/schema";
import { apiError } from "@/lib/api";
import { sendClinicEmail } from "@/lib/email";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const createClientSchema = z.object({ firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), dob: z.iso.date(), parentName: z.string().trim().min(1), parentEmail: z.email(), therapistUserId: z.string().min(1), intakeNotes: z.string().optional() });

export async function POST(request: Request) {
  try {
    const actor = await requireRole(["admin", "therapist"]); const input = createClientSchema.parse(await request.json());
    const [client] = await db.insert(clients).values({ ...input, clinicId: actor.clinicId }).returning();
    await sendClinicEmail({ clinicId: actor.clinicId, to: input.parentEmail, kind: "parent_invite", subject: `${input.firstName}'s care team invited you to Sayso`, message: "Create your parent account to complete intake, see appointments, and receive session updates.", actionUrl: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/sign-up?email=${encodeURIComponent(input.parentEmail)}`, actionLabel: "Create parent account" });
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) { return apiError(error); }
}
