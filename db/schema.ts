import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const audit = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

// Better Auth tables. The clinic maps one-to-one to an organization.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...audit,
});
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
    ...audit,
  },
  (table) => [index("session_user_idx").on(table.userId)],
);
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...audit,
  },
  (table) => [index("account_user_idx").on(table.userId)],
);
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...audit,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  ...audit,
});
export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("parent").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("member_org_user_idx").on(table.organizationId, table.userId)],
);
export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("invitation_email_idx").on(table.email)],
);

export const clientStatus = pgEnum("client_status", ["active", "inactive"]);
export const documentStatus = pgEnum("document_status", ["pending", "done", "failed"]);
export const goalStatus = pgEnum("goal_status", ["active", "met", "dropped"]);
export const appointmentStatus = pgEnum("appointment_status", [
  "scheduled",
  "done",
  "cancelled",
  "no_show",
]);
export const aiTask = pgEnum("ai_task", ["extract_iep", "session_summary", "next_steps"]);

export const clinics = pgTable("clinics", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").default("America/New_York").notNull(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id),
  ...audit,
});
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dob: text("dob").notNull(),
    therapistUserId: text("therapist_user_id")
      .notNull()
      .references(() => user.id),
    parentUserId: text("parent_user_id").references(() => user.id),
    parentName: text("parent_name").notNull(),
    parentEmail: text("parent_email").notNull(),
    intakeNotes: text("intake_notes"),
    concerns: text("concerns"),
    homeLanguages: text("home_languages"),
    consent: boolean("consent").default(false).notNull(),
    status: clientStatus("status").default("active").notNull(),
    ...audit,
  },
  (table) => [
    index("clients_clinic_idx").on(table.clinicId),
    index("clients_therapist_idx").on(table.therapistUserId),
  ],
);
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    blobUrl: text("blob_url").notNull(),
    kind: text("kind").default("iep").notNull(),
    extracted: jsonb("extracted"),
    status: documentStatus("status").default("pending").notNull(),
    ...audit,
  },
  (table) => [index("documents_client_idx").on(table.clientId)],
);
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    text: text("text").notNull(),
    baseline: text("baseline"),
    criterion: text("criterion"),
    status: goalStatus("status").default("active").notNull(),
    sourceDocumentId: uuid("source_document_id").references(() => documents.id),
    ...audit,
  },
  (table) => [index("goals_client_idx").on(table.clientId)],
);
export const availability = pgTable(
  "availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    therapistUserId: text("therapist_user_id")
      .notNull()
      .references(() => user.id),
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    ...audit,
  },
  (table) => [index("availability_therapist_idx").on(table.therapistUserId)],
);
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    therapistUserId: text("therapist_user_id")
      .notNull()
      .references(() => user.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    minutes: integer("minutes").default(45).notNull(),
    status: appointmentStatus("status").default("scheduled").notNull(),
    planText: text("plan_text"),
    noteText: text("note_text"),
    parentSummaryText: text("parent_summary_text"),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    ...audit,
  },
  (table) => [
    index("appointments_clinic_start_idx").on(table.clinicId, table.startsAt),
    index("appointments_therapist_start_idx").on(table.therapistUserId, table.startsAt),
  ],
);
export const progress = pgTable(
  "progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("progress_goal_appointment_idx").on(table.goalId, table.appointmentId),
  ],
);
export const aiCalls = pgTable(
  "ai_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    task: aiTask("task").notNull(),
    model: text("model").notNull(),
    tokensIn: integer("tokens_in").default(0).notNull(),
    tokensOut: integer("tokens_out").default(0).notNull(),
    ms: integer("ms").notNull(),
    ok: boolean("ok").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ai_calls_clinic_idx").on(table.clinicId)],
);
export const emails = pgTable(
  "emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    to: text("to").notNull(),
    kind: text("kind").notNull(),
    resendId: text("resend_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("emails_clinic_idx").on(table.clinicId)],
);

export type Role = "admin" | "therapist" | "parent";
