import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { MAX_EVENT_DURATION_MS, validateEvent } from "./eventValidation";

async function getEventsOverlappingRange(
  ctx: QueryCtx,
  rangeStart: number,
  rangeEnd: number
) {
  const earliestRelevantStart = rangeStart - MAX_EVENT_DURATION_MS;
  const candidates = await ctx.db
    .query("events")
    .withIndex("by_start", (q) =>
      q.gte("start", earliestRelevantStart).lt("start", rangeEnd)
    )
    .collect();

  return candidates
    .filter((event) => event.end > rangeStart)
    .sort((a, b) => a.start - b.start);
}

export const getWeekEvents = query({
  args: {
    weekStart: v.number()
  },
  handler: async (ctx, args) => {
    const start = args.weekStart;
    const end = start + 7 * 24 * 60 * 60 * 1000;
    return getEventsOverlappingRange(ctx, start, end);
  }
});

export const getTodayEvents = query({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = now.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return getEventsOverlappingRange(ctx, start, end);
  }
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db.query("memberships").collect();
    const uniqueUserIds = new Set(memberships.map((m) => m.userId));

    const calendars = await ctx.db.query("calendars").collect();

    // Count overlapping events for today
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayStart = now.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    const todayEvents = await getEventsOverlappingRange(
      ctx,
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
      { label: "Active family members", value: String(uniqueUserIds.size) },
      { label: "Connected calendars", value: String(calendars.length) },
      { label: "Pending conflicts", value: String(conflicts) }
    ];
  }
});

export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    location: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    validateEvent(args);

    // Get or create a default calendar
    let calendar = await ctx.db.query("calendars").first();

    if (!calendar) {
      // Create default workspace and calendar
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        name: "Default User",
        email: "user@example.com",
        timezone: "America/Los_Angeles",
        createdAt: now
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Family HQ",
        ownerId: userId,
        plan: "starter",
        createdAt: now
      });
      const calendarId = await ctx.db.insert("calendars", {
        workspaceId,
        provider: "convex",
        externalId: `family-${workspaceId}`,
        syncStatus: "ready",
        name: "Family Calendar",
        timezone: "America/Los_Angeles"
      });
      calendar = await ctx.db.get(calendarId);
    }

    const now = Date.now();
    return ctx.db.insert("events", {
      calendarId: calendar!._id,
      title: args.title,
      description: args.description,
      start: args.start,
      end: args.end,
      location: args.location,
      updatedAt: now,
      createdAt: now
    });
  }
});

export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    location: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    validateEvent(args);
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now()
    });
  }
});

export const batchCreateEvents = mutation({
  args: {
    events: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        start: v.number(),
        end: v.number(),
        location: v.optional(v.string()),
      })
    ),
    recurrenceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate all events
    for (const event of args.events) {
      validateEvent(event);
    }

    // Get or create a default calendar (same logic as createEvent)
    let calendar = await ctx.db.query("calendars").first();
    if (!calendar) {
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        name: "Default User",
        email: "user@example.com",
        timezone: "America/Los_Angeles",
        createdAt: now,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Family HQ",
        ownerId: userId,
        plan: "starter",
        createdAt: now,
      });
      const calendarId = await ctx.db.insert("calendars", {
        workspaceId,
        provider: "convex",
        externalId: `family-${workspaceId}`,
        syncStatus: "ready",
        name: "Family Calendar",
        timezone: "America/Los_Angeles",
      });
      calendar = await ctx.db.get(calendarId);
    }

    const now = Date.now();
    await Promise.all(
      args.events.map((event) =>
        ctx.db.insert("events", {
          calendarId: calendar!._id,
          title: event.title,
          description: event.description,
          start: event.start,
          end: event.end,
          location: event.location,
          recurrence: args.recurrenceId,
          updatedAt: now,
          createdAt: now,
        })
      )
    );
  },
});

export const deleteEvent = mutation({
  args: {
    id: v.id("events")
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  }
});

export const deleteRecurringEvents = mutation({
  args: {
    recurrenceId: v.string(),
    fromStart: v.number(),
  },
  handler: async (ctx, args) => {
    // Find all events with this recurrenceId that start at or after fromStart
    const allEvents = await ctx.db
      .query("events")
      .withIndex("by_start", (q) => q.gte("start", args.fromStart))
      .collect();

    const toDelete = allEvents.filter(
      (e) => e.recurrence === args.recurrenceId
    );

    await Promise.all(toDelete.map((e) => ctx.db.delete(e._id)));
    return { deleted: toDelete.length };
  }
});

export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("events").first();
    if (existing) {
      return { seeded: false };
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name: "Alex Johnson",
      email: "alex@example.com",
      timezone: "America/Los_Angeles",
      preferences: {
        weekStart: "Mon",
        quietHours: ["9:00 PM - 7:00 AM"],
        defaultBuffers: 15
      },
      createdAt: now
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Family HQ",
      ownerId: userId,
      plan: "starter",
      createdAt: now
    });
    await ctx.db.insert("memberships", {
      userId,
      workspaceId,
      role: "owner",
      createdAt: now
    });
    const calendarId = await ctx.db.insert("calendars", {
      workspaceId,
      provider: "convex",
      externalId: `family-${workspaceId}`,
      syncStatus: "ready",
      name: "Family Calendar",
      timezone: "America/Los_Angeles"
    });

    // Create events relative to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const buildDate = (dayOffset: number, hour: number, minute = 0) => {
      const date = new Date(today);
      date.setDate(today.getDate() + mondayOffset + dayOffset);
      date.setHours(hour, minute, 0, 0);
      return date.getTime();
    };

    const events = [
      {
        title: "School drop-off",
        start: buildDate(0, 7, 30),
        end: buildDate(0, 8, 0),
        location: "Sunrise Elementary",
        description: "Remember to bring art supplies"
      },
      {
        title: "Team standup",
        start: buildDate(0, 9, 0),
        end: buildDate(0, 9, 30),
        location: "Google Meet",
        description: "Daily sync with the team"
      },
      {
        title: "Grocery pickup",
        start: buildDate(0, 17, 0),
        end: buildDate(0, 17, 30),
        location: "Whole Foods",
        description: "Order #4521"
      },
      {
        title: "Lunch with grandparents",
        start: buildDate(1, 12, 0),
        end: buildDate(1, 13, 30),
        location: "Olive Garden",
        description: "Monthly family lunch"
      },
      {
        title: "Piano lesson",
        start: buildDate(1, 16, 0),
        end: buildDate(1, 17, 0),
        location: "Music Academy",
        description: "Jamie's weekly lesson"
      },
      {
        title: "Dentist appointment",
        start: buildDate(2, 10, 0),
        end: buildDate(2, 10, 45),
        location: "Oak Street Dental",
        description: "Regular checkup for Jamie"
      },
      {
        title: "Book club meeting",
        start: buildDate(2, 14, 0),
        end: buildDate(2, 15, 30),
        location: "Public Library",
        description: "Discussing 'The Midnight Library'"
      },
      {
        title: "Soccer practice",
        start: buildDate(3, 16, 0),
        end: buildDate(3, 17, 30),
        location: "Community Field",
        description: "Bring water and snacks"
      },
      {
        title: "Parent-teacher conference",
        start: buildDate(4, 15, 0),
        end: buildDate(4, 15, 45),
        location: "Sunrise Elementary",
        description: "Meeting with Ms. Thompson"
      },
      {
        title: "Movie matinee",
        start: buildDate(5, 14, 0),
        end: buildDate(5, 16, 30),
        location: "AMC Theater",
        description: "Family movie outing"
      },
      {
        title: "Farmers market",
        start: buildDate(6, 9, 0),
        end: buildDate(6, 11, 0),
        location: "Downtown Market",
        description: "Weekly groceries"
      },
      {
        title: "Brunch with friends",
        start: buildDate(6, 11, 30),
        end: buildDate(6, 13, 0),
        location: "The Breakfast Club",
        description: "Monthly catch-up"
      }
    ];

    await Promise.all(
      events.map((event) =>
        ctx.db.insert("events", {
          calendarId,
          title: event.title,
          description: event.description,
          start: event.start,
          end: event.end,
          location: event.location,
          updatedAt: now,
          createdAt: now
        })
      )
    );

    return { seeded: true };
  }
});
