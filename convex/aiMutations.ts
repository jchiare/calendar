import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { validateEvent } from "./eventValidation";

export const createEventFromAI = internalMutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    validateEvent(args);

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
    await ctx.db.insert("events", {
      calendarId: calendar!._id,
      title: args.title,
      description: args.description,
      start: args.start,
      end: args.end,
      updatedAt: now,
      createdAt: now,
    });
  },
});
