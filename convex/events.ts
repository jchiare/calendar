import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

export const getWeekEvents = queryGeneric({
  args: {
    weekStart: v.number()
  },
  handler: async (ctx: any, args: { weekStart: number }) => {
    const start = args.weekStart;
    const end = start + 7 * 24 * 60 * 60 * 1000;

    const events = await ctx.db.query("events").collect();
    return events.filter((e: any) => e.start >= start && e.start < end);
  }
});

export const getTodayEvents = queryGeneric({
  args: {},
  handler: async (ctx: any) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = now.getTime();
    const end = start + 24 * 60 * 60 * 1000;

    const events = await ctx.db.query("events").collect();
    return events
      .filter((e: any) => e.start >= start && e.start < end)
      .sort((a: any, b: any) => a.start - b.start);
  }
});

export const createEvent = mutationGeneric({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    location: v.optional(v.string())
  },
  handler: async (ctx: any, args: any) => {
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

export const updateEvent = mutationGeneric({
  args: {
    id: v.id("events"),
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    location: v.optional(v.string())
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now()
    });
  }
});

export const deleteEvent = mutationGeneric({
  args: {
    id: v.id("events")
  },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id);
  }
});

export const seedDemo = mutationGeneric({
  args: {},
  handler: async (ctx: any) => {
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
        title: "Lunch with grandparents",
        start: buildDate(1, 12, 0),
        end: buildDate(1, 13, 30),
        location: "Olive Garden",
        description: "Monthly family lunch"
      },
      {
        title: "Dentist appointment",
        start: buildDate(2, 15, 0),
        end: buildDate(2, 15, 45),
        location: "Oak Street Dental",
        description: "Regular checkup for Jamie"
      },
      {
        title: "Soccer practice",
        start: buildDate(3, 16, 0),
        end: buildDate(3, 17, 30),
        location: "Community Field",
        description: "Bring water and snacks"
      },
      {
        title: "Family dinner",
        start: buildDate(4, 18, 0),
        end: buildDate(4, 19, 30),
        location: "Home",
        description: "Pizza night!"
      },
      {
        title: "Movie night",
        start: buildDate(5, 20, 0),
        end: buildDate(5, 22, 30),
        location: "Home",
        description: "Family movie selection"
      },
      {
        title: "Farmers market",
        start: buildDate(6, 9, 0),
        end: buildDate(6, 11, 0),
        location: "Downtown Market",
        description: "Weekly groceries"
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
