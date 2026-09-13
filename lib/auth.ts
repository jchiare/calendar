import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendClinicEmail } from "./email";

const statement = {
  client: ["create", "read", "update", "delete"],
  appointment: ["create", "read", "update", "cancel"],
  note: ["create", "read", "update"],
  settings: ["read", "update"],
} as const;
const ac = createAccessControl(statement);
const admin = ac.newRole({
  client: ["create", "read", "update", "delete"],
  appointment: ["create", "read", "update", "cancel"],
  note: ["create", "read", "update"],
  settings: ["read", "update"],
});
const therapist = ac.newRole({
  client: ["create", "read", "update"],
  appointment: ["create", "read", "update", "cancel"],
  note: ["create", "read", "update"],
  settings: ["read"],
});
const parent = ac.newRole({
  client: ["read", "update"],
  appointment: ["create", "read", "cancel"],
  note: ["read"],
  settings: [],
});

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET ?? "sayso-local-development-secret-change-me",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      ac,
      roles: { admin, therapist, parent },
      allowUserToCreateOrganization: false,
      async sendInvitationEmail(data) {
        const link = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/accept-invitation/${data.id}`;
        await sendClinicEmail({
          clinicId: null,
          to: data.email,
          kind: "parent_invite",
          subject: `You're invited to ${data.organization.name}`,
          actionUrl: link,
          actionLabel: "Accept invitation",
          message:
            "Create your account to view appointments and updates from your care team.",
        });
      },
    }),
  ],
});

export type AppSession = typeof auth.$Infer.Session;

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
