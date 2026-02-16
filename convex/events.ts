import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { MAX_EVENT_DURATION_MS, validateEvent } from "./eventValidation";

const READ_ONLY_ROLES = new Set(["child-view", "guest"]);
const ONBOARDING_SEED_VERSION = "household-onboarding-v1";
const ONBOARDING_WORKSPACE_NAME = "Rivera Household";
const ONBOARDING_SHARED_CALENDAR_EXTERNAL_ID =
  "onboarding-rivera-family-shared-v1";
const ONBOARDING_ALEX_CALENDAR_EXTERNAL_ID = "onboarding-rivera-alex-work-v1";
const ONBOARDING_MIA_CALENDAR_EXTERNAL_ID = "onboarding-rivera-mia-school-v1";

type DbCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

type SeedOutcome = {
  workspaceId: Id<"workspaces">;
  activeUserId: Id<"users">;
  createdWorkspace: boolean;
  seededEvents: boolean;
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function rolePriority(role: string): number {
  if (role === "owner") return 0;
  if (role === "adult") return 1;
  if (role === "caregiver") return 2;
  if (role === "child-view") return 3;
  return 4;
}

async function getWorkspaceCalendars(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">
): Promise<Doc<"calendars">[]> {
  return ctx.db
    .query("calendars")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
}

async function getWorkspaceMemberships(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">
): Promise<Doc<"memberships">[]> {
  return ctx.db
    .query("memberships")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
}

async function getWorkspaceEvents(ctx: DbCtx, workspaceId: Id<"workspaces">) {
  const calendars = await getWorkspaceCalendars(ctx, workspaceId);
  if (calendars.length === 0) return [];

  const calendarIds = new Set(calendars.map((calendar) => calendar._id));
  const allEvents = await ctx.db.query("events").collect();
  return allEvents.filter((event) => calendarIds.has(event.calendarId));
}

async function getEventsOverlappingRange(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  rangeStart: number,
  rangeEnd: number
) {
  const calendars = await getWorkspaceCalendars(ctx, workspaceId);
  if (calendars.length === 0) return [];

  const calendarIds = new Set(calendars.map((calendar) => calendar._id));
  const earliestRelevantStart = rangeStart - MAX_EVENT_DURATION_MS;
  const candidates = await ctx.db
    .query("events")
    .withIndex("by_start", (q) =>
      q.gte("start", earliestRelevantStart).lt("start", rangeEnd)
    )
    .collect();

  return candidates
    .filter(
      (event) => event.end > rangeStart && calendarIds.has(event.calendarId)
    )
    .sort((a, b) => a.start - b.start);
}

async function getMembershipForUser(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">
) {
  const memberships = await getWorkspaceMemberships(ctx, workspaceId);
  return memberships.find((membership) => membership.userId === userId) ?? null;
}

async function assertWorkspaceWriteAccess(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  actorUserId: Id<"users">
) {
  const membership = await getMembershipForUser(ctx, workspaceId, actorUserId);
  if (!membership) {
    throw new Error("You are not a member of this household workspace.");
  }
  if (READ_ONLY_ROLES.has(membership.role)) {
    throw new Error("Your role is read-only for calendar edits.");
  }
}

async function assertEventInWorkspace(
  ctx: MutationCtx,
  eventId: Id<"events">,
  workspaceId: Id<"workspaces">
) {
  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new Error("Event not found.");
  }

  const calendar = await ctx.db.get(event.calendarId);
  if (!calendar || calendar.workspaceId !== workspaceId) {
    throw new Error("Event does not belong to this household workspace.");
  }

  return event;
}

async function getOrCreatePrimaryCalendar(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const onboardingSharedCalendar = await ctx.db
    .query("calendars")
    .withIndex("by_provider_external", (q) =>
      q
        .eq("provider", "convex")
        .eq("externalId", ONBOARDING_SHARED_CALENDAR_EXTERNAL_ID)
    )
    .first();

  if (
    onboardingSharedCalendar &&
    onboardingSharedCalendar.workspaceId === workspaceId
  ) {
    return onboardingSharedCalendar;
  }

  const calendars = await getWorkspaceCalendars(ctx, workspaceId);
  if (calendars.length > 0) {
    return calendars[0];
  }

  const calendarId = await ctx.db.insert("calendars", {
    workspaceId,
    provider: "convex",
    externalId: `workspace-${workspaceId}-shared`,
    syncStatus: "ready",
    name: "Family Shared",
    timezone: "America/Los_Angeles",
  });

  const createdCalendar = await ctx.db.get(calendarId);
  if (!createdCalendar) {
    throw new Error("Failed to create workspace calendar.");
  }
  return createdCalendar;
}

async function ensureUserByEmail(
  ctx: MutationCtx,
  {
    name,
    email,
    timezone,
  }: { name: string; email: string; timezone: string }
): Promise<Doc<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (existing) {
    if (existing.name !== name || existing.timezone !== timezone) {
      await ctx.db.patch(existing._id, { name, timezone });
    }
    const updated = await ctx.db.get(existing._id);
    if (!updated) throw new Error("Failed to load existing user.");
    return updated;
  }

  const userId = await ctx.db.insert("users", {
    name,
    email,
    timezone,
    createdAt: Date.now(),
  });
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Failed to create user.");
  return user;
}

async function ensureWorkspaceForOwner(
  ctx: MutationCtx,
  ownerId: Id<"users">
): Promise<{ workspace: Doc<"workspaces">; createdWorkspace: boolean }> {
  const ownedWorkspaces = await ctx.db
    .query("workspaces")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();

  const existing =
    ownedWorkspaces.find(
      (workspace) => workspace.name === ONBOARDING_WORKSPACE_NAME
    ) ?? null;

  if (existing) {
    return { workspace: existing, createdWorkspace: false };
  }

  const workspaceId = await ctx.db.insert("workspaces", {
    name: ONBOARDING_WORKSPACE_NAME,
    ownerId,
    plan: "starter",
    createdAt: Date.now(),
  });

  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new Error("Failed to create workspace.");
  return { workspace, createdWorkspace: true };
}

async function ensureMembershipRole(
  ctx: MutationCtx,
  existingMemberships: Doc<"memberships">[],
  {
    workspaceId,
    userId,
    role,
    createdAt,
  }: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    role: string;
    createdAt: number;
  }
) {
  const existingMembership =
    existingMemberships.find((membership) => membership.userId === userId) ??
    null;

  if (existingMembership) {
    if (existingMembership.role !== role) {
      await ctx.db.patch(existingMembership._id, { role });
    }
    return;
  }

  await ctx.db.insert("memberships", {
    userId,
    workspaceId,
    role,
    createdAt,
  });
}

async function ensureCalendar(
  ctx: MutationCtx,
  {
    workspaceId,
    externalId,
    name,
    timezone,
  }: {
    workspaceId: Id<"workspaces">;
    externalId: string;
    name: string;
    timezone: string;
  }
) {
  const existing = await ctx.db
    .query("calendars")
    .withIndex("by_provider_external", (q) =>
      q.eq("provider", "convex").eq("externalId", externalId)
    )
    .first();

  if (existing) {
    if (
      existing.workspaceId !== workspaceId ||
      existing.name !== name ||
      existing.timezone !== timezone ||
      existing.syncStatus !== "ready"
    ) {
      await ctx.db.patch(existing._id, {
        workspaceId,
        name,
        timezone,
        syncStatus: "ready",
      });
    }
    const updated = await ctx.db.get(existing._id);
    if (!updated) throw new Error("Failed to load existing calendar.");
    return updated;
  }

  const calendarId = await ctx.db.insert("calendars", {
    workspaceId,
    provider: "convex",
    externalId,
    syncStatus: "ready",
    name,
    timezone,
  });
  const calendar = await ctx.db.get(calendarId);
  if (!calendar) throw new Error("Failed to create calendar.");
  return calendar;
}

async function ensureOnboardingSeedData(ctx: MutationCtx): Promise<SeedOutcome> {
  const now = Date.now();

  const alex = await ensureUserByEmail(ctx, {
    name: "Alex Rivera",
    email: "alex@rivera.family",
    timezone: "America/Los_Angeles",
  });
  const jordan = await ensureUserByEmail(ctx, {
    name: "Jordan Rivera",
    email: "jordan@rivera.family",
    timezone: "America/Los_Angeles",
  });
  const mia = await ensureUserByEmail(ctx, {
    name: "Mia Rivera",
    email: "mia@rivera.family",
    timezone: "America/Los_Angeles",
  });
  const nana = await ensureUserByEmail(ctx, {
    name: "Nana Rivera",
    email: "nana@rivera.family",
    timezone: "America/Los_Angeles",
  });

  const { workspace, createdWorkspace } = await ensureWorkspaceForOwner(
    ctx,
    alex._id
  );

  const existingMemberships = await getWorkspaceMemberships(ctx, workspace._id);
  await ensureMembershipRole(ctx, existingMemberships, {
    workspaceId: workspace._id,
    userId: alex._id,
    role: "owner",
    createdAt: now,
  });
  await ensureMembershipRole(ctx, existingMemberships, {
    workspaceId: workspace._id,
    userId: jordan._id,
    role: "adult",
    createdAt: now,
  });
  await ensureMembershipRole(ctx, existingMemberships, {
    workspaceId: workspace._id,
    userId: mia._id,
    role: "child-view",
    createdAt: now,
  });
  await ensureMembershipRole(ctx, existingMemberships, {
    workspaceId: workspace._id,
    userId: nana._id,
    role: "caregiver",
    createdAt: now,
  });

  const sharedCalendar = await ensureCalendar(ctx, {
    workspaceId: workspace._id,
    externalId: ONBOARDING_SHARED_CALENDAR_EXTERNAL_ID,
    name: "Family Shared",
    timezone: "America/Los_Angeles",
  });
  const alexCalendar = await ensureCalendar(ctx, {
    workspaceId: workspace._id,
    externalId: ONBOARDING_ALEX_CALENDAR_EXTERNAL_ID,
    name: "Alex - Work",
    timezone: "America/Los_Angeles",
  });
  const miaCalendar = await ensureCalendar(ctx, {
    workspaceId: workspace._id,
    externalId: ONBOARDING_MIA_CALENDAR_EXTERNAL_ID,
    name: "Mia - School",
    timezone: "America/Los_Angeles",
  });

  const existingEvents = await getWorkspaceEvents(ctx, workspace._id);
  let seededEvents = false;

  if (existingEvents.length === 0) {
    seededEvents = true;
    const weekStart = getWeekStart(new Date());
    const slot = (
      dayOffset: number,
      hour: number,
      minute: number,
      durationMinutes: number
    ) => {
      const start = new Date(weekStart);
      start.setDate(weekStart.getDate() + dayOffset);
      start.setHours(hour, minute, 0, 0);
      return {
        start: start.getTime(),
        end: start.getTime() + durationMinutes * 60 * 1000,
      };
    };

    const events = [
      {
        calendarId: sharedCalendar._id,
        ownerUserId: jordan._id,
        participantUserIds: [mia._id],
        title: "School drop-off",
        description: "Backpack + lunch check",
        location: "Oakridge Elementary",
        ...slot(1, 7, 20, 35),
      },
      {
        calendarId: alexCalendar._id,
        ownerUserId: alex._id,
        participantUserIds: [],
        title: "Product roadmap sync",
        description: "Q2 priorities and launch sequencing",
        location: "HQ Room 2B",
        ...slot(1, 9, 30, 60),
      },
      {
        calendarId: sharedCalendar._id,
        ownerUserId: jordan._id,
        participantUserIds: [mia._id, nana._id],
        title: "Soccer practice pickup",
        description: "Traffic-sensitive route",
        location: "North Field",
        ...slot(1, 17, 15, 75),
      },
      {
        calendarId: miaCalendar._id,
        ownerUserId: mia._id,
        participantUserIds: [nana._id],
        title: "Piano lesson",
        description: "Book 3, pages 14-16",
        location: "Bright Keys Studio",
        ...slot(2, 16, 0, 60),
      },
      {
        calendarId: sharedCalendar._id,
        ownerUserId: alex._id,
        participantUserIds: [jordan._id],
        title: "Fridge inventory check",
        description: "Plan grocery reorder before Thursday",
        location: "Home",
        ...slot(3, 19, 30, 30),
      },
      {
        calendarId: sharedCalendar._id,
        ownerUserId: nana._id,
        participantUserIds: [mia._id],
        title: "Dentist appointment",
        description: "Bring insurance card",
        location: "Smile Dental Group",
        ...slot(4, 14, 30, 60),
      },
      {
        calendarId: sharedCalendar._id,
        ownerUserId: jordan._id,
        participantUserIds: [alex._id, mia._id, nana._id],
        title: "Family week planning",
        description: "Review school events + travel window",
        location: "Kitchen table",
        ...slot(5, 18, 0, 45),
      },
      {
        calendarId: sharedCalendar._id,
        ownerUserId: alex._id,
        participantUserIds: [jordan._id],
        title: "Grocery restock run",
        description: "Use inventory list before leaving",
        location: "Green Market",
        ...slot(6, 10, 0, 90),
      },
    ];

    await Promise.all(
      events.map((event) =>
        ctx.db.insert("events", {
          calendarId: event.calendarId,
          title: event.title,
          description: event.description,
          start: event.start,
          end: event.end,
          location: event.location,
          metadata: {
            seedVersion: ONBOARDING_SEED_VERSION,
            ownerUserId: event.ownerUserId,
            participantUserIds: event.participantUserIds,
            createdByUserId: alex._id,
          },
          updatedAt: now,
          createdAt: now,
        })
      )
    );
  }

  return {
    workspaceId: workspace._id,
    activeUserId: alex._id,
    createdWorkspace,
    seededEvents,
  };
}

async function getActiveWorkspace(ctx: DbCtx): Promise<Doc<"workspaces"> | null> {
  const onboardingCalendar = await ctx.db
    .query("calendars")
    .withIndex("by_provider_external", (q) =>
      q
        .eq("provider", "convex")
        .eq("externalId", ONBOARDING_SHARED_CALENDAR_EXTERNAL_ID)
    )
    .first();

  if (onboardingCalendar) {
    const workspace = await ctx.db.get(onboardingCalendar.workspaceId);
    if (workspace) {
      return workspace;
    }
  }

  const workspaces = await ctx.db.query("workspaces").collect();
  if (workspaces.length === 0) return null;
  workspaces.sort((a, b) => a.createdAt - b.createdAt);
  return workspaces[0];
}

async function buildHouseholdContext(
  ctx: DbCtx,
  workspace: Doc<"workspaces">
) {
  const [memberships, calendars, events, owner] = await Promise.all([
    getWorkspaceMemberships(ctx, workspace._id),
    getWorkspaceCalendars(ctx, workspace._id),
    getWorkspaceEvents(ctx, workspace._id),
    ctx.db.get(workspace.ownerId),
  ]);

  const members = (
    await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        if (!user) return null;
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          role: membership.role,
        };
      })
    )
  )
    .filter((member): member is NonNullable<typeof member> => member !== null)
    .sort(
      (a, b) =>
        rolePriority(a.role) - rolePriority(b.role) || a.name.localeCompare(b.name)
    );

  const activeUserId = owner?._id ?? members[0]?.id ?? workspace.ownerId;
  const activeUserName =
    members.find((member) => member.id === activeUserId)?.name ??
    owner?.name ??
    "Household Admin";

  return {
    workspaceId: workspace._id,
    workspaceName: workspace.name,
    activeUserId,
    activeUserName,
    members,
    calendarCount: calendars.length,
    eventCount: events.length,
    onboardingSeedVersion: ONBOARDING_SEED_VERSION,
  };
}

export const getHouseholdContext = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await getActiveWorkspace(ctx);
    if (!workspace) return null;
    return buildHouseholdContext(ctx, workspace);
  },
});

export const ensureOnboardingSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const result = await ensureOnboardingSeedData(ctx);
    const workspace = await ctx.db.get(result.workspaceId);
    if (!workspace) {
      throw new Error("Failed to load seeded workspace.");
    }

    const context = await buildHouseholdContext(ctx, workspace);
    return {
      ...context,
      seededEvents: result.seededEvents,
      createdWorkspace: result.createdWorkspace,
    };
  },
});

export const getWeekEvents = query({
  args: {
    workspaceId: v.id("workspaces"),
    weekStart: v.number(),
  },
  handler: async (ctx, args) => {
    const start = args.weekStart;
    const end = start + 7 * 24 * 60 * 60 * 1000;
    return getEventsOverlappingRange(ctx, args.workspaceId, start, end);
  },
});

export const getTodayEvents = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = now.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return getEventsOverlappingRange(ctx, args.workspaceId, start, end);
  },
});

export const getStats = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const memberships = await getWorkspaceMemberships(ctx, args.workspaceId);
    const calendars = await getWorkspaceCalendars(ctx, args.workspaceId);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayStart = now.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    const todayEvents = await getEventsOverlappingRange(
      ctx,
      args.workspaceId,
      todayStart,
      todayEnd
    );

    let conflicts = 0;
    for (let i = 0; i < todayEvents.length; i++) {
      for (let j = i + 1; j < todayEvents.length; j++) {
        if (todayEvents[i].end > todayEvents[j].start) {
          conflicts++;
        }
      }
    }

    return [
      { label: "Active family members", value: String(memberships.length) },
      { label: "Connected calendars", value: String(calendars.length) },
      { label: "Pending conflicts", value: String(conflicts) },
    ];
  },
});

export const createEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    actorUserId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    location: v.optional(v.string()),
    ownerUserId: v.optional(v.id("users")),
    participantUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    validateEvent(args);
    await assertWorkspaceWriteAccess(ctx, args.workspaceId, args.actorUserId);

    const calendar = await getOrCreatePrimaryCalendar(ctx, args.workspaceId);
    const now = Date.now();

    return ctx.db.insert("events", {
      calendarId: calendar._id,
      title: args.title,
      description: args.description,
      start: args.start,
      end: args.end,
      location: args.location,
      metadata: {
        ownerUserId: args.ownerUserId ?? args.actorUserId,
        participantUserIds: args.participantUserIds ?? [],
        createdByUserId: args.actorUserId,
      },
      updatedAt: now,
      createdAt: now,
    });
  },
});

export const updateEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    actorUserId: v.id("users"),
    id: v.id("events"),
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    validateEvent(args);
    await assertWorkspaceWriteAccess(ctx, args.workspaceId, args.actorUserId);
    await assertEventInWorkspace(ctx, args.id, args.workspaceId);

    const { id, workspaceId: _workspaceId, actorUserId: _actorUserId, ...updates } =
      args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const batchCreateEvents = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    actorUserId: v.id("users"),
    events: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        start: v.number(),
        end: v.number(),
        location: v.optional(v.string()),
        ownerUserId: v.optional(v.id("users")),
        participantUserIds: v.optional(v.array(v.id("users"))),
      })
    ),
    recurrenceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertWorkspaceWriteAccess(ctx, args.workspaceId, args.actorUserId);
    for (const event of args.events) {
      validateEvent(event);
    }

    const calendar = await getOrCreatePrimaryCalendar(ctx, args.workspaceId);
    const now = Date.now();

    await Promise.all(
      args.events.map((event) =>
        ctx.db.insert("events", {
          calendarId: calendar._id,
          title: event.title,
          description: event.description,
          start: event.start,
          end: event.end,
          location: event.location,
          recurrence: args.recurrenceId,
          metadata: {
            ownerUserId: event.ownerUserId ?? args.actorUserId,
            participantUserIds: event.participantUserIds ?? [],
            createdByUserId: args.actorUserId,
          },
          updatedAt: now,
          createdAt: now,
        })
      )
    );
  },
});

export const deleteEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    actorUserId: v.id("users"),
    id: v.id("events"),
  },
  handler: async (ctx, args) => {
    await assertWorkspaceWriteAccess(ctx, args.workspaceId, args.actorUserId);
    await assertEventInWorkspace(ctx, args.id, args.workspaceId);
    await ctx.db.delete(args.id);
  },
});

export const deleteRecurringEvents = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    actorUserId: v.id("users"),
    recurrenceId: v.string(),
    fromStart: v.number(),
  },
  handler: async (ctx, args) => {
    await assertWorkspaceWriteAccess(ctx, args.workspaceId, args.actorUserId);

    const calendars = await getWorkspaceCalendars(ctx, args.workspaceId);
    const calendarIds = new Set(calendars.map((calendar) => calendar._id));

    const allEvents = await ctx.db
      .query("events")
      .withIndex("by_start", (q) => q.gte("start", args.fromStart))
      .collect();

    const toDelete = allEvents.filter(
      (event) =>
        event.recurrence === args.recurrenceId &&
        calendarIds.has(event.calendarId)
    );

    await Promise.all(toDelete.map((event) => ctx.db.delete(event._id)));
    return { deleted: toDelete.length };
  },
});

export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const result = await ensureOnboardingSeedData(ctx);
    return { seeded: result.seededEvents };
  },
});
