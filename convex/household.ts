import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Preset member colors (accessible, distinct hues)
export const MEMBER_COLORS = [
  { name: "indigo", bg: "bg-indigo-100", border: "border-indigo-200", text: "text-indigo-900", hex: "#6366f1" },
  { name: "rose", bg: "bg-rose-100", border: "border-rose-200", text: "text-rose-900", hex: "#f43f5e" },
  { name: "amber", bg: "bg-amber-100", border: "border-amber-200", text: "text-amber-900", hex: "#f59e0b" },
  { name: "emerald", bg: "bg-emerald-100", border: "border-emerald-200", text: "text-emerald-900", hex: "#10b981" },
  { name: "cyan", bg: "bg-cyan-100", border: "border-cyan-200", text: "text-cyan-900", hex: "#06b6d4" },
  { name: "purple", bg: "bg-purple-100", border: "border-purple-200", text: "text-purple-900", hex: "#a855f7" },
  { name: "orange", bg: "bg-orange-100", border: "border-orange-200", text: "text-orange-900", hex: "#f97316" },
  { name: "teal", bg: "bg-teal-100", border: "border-teal-200", text: "text-teal-900", hex: "#14b8a6" },
] as const;

export const getHousehold = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspaces").first();
    if (!workspace) return null;

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user
          ? {
              _id: user._id,
              name: user.name,
              email: user.email,
              color: user.color ?? "indigo",
              avatarEmoji: user.avatarEmoji,
              role: m.role,
            }
          : null;
      })
    );

    return {
      _id: workspace._id,
      name: workspace.name,
      members: members.filter(Boolean),
    };
  },
});

export const setupHousehold = mutation({
  args: {
    householdName: v.string(),
    members: v.array(
      v.object({
        name: v.string(),
        emoji: v.optional(v.string()),
        color: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Don't create if household already exists
    const existing = await ctx.db.query("workspaces").first();
    if (existing) return { workspaceId: existing._id };

    const now = Date.now();

    // Create the first member as owner
    const ownerData = args.members[0];
    const ownerId = await ctx.db.insert("users", {
      name: ownerData.name,
      email: `${ownerData.name.toLowerCase().replace(/\s+/g, ".")}@household.local`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
      color: ownerData.color,
      avatarEmoji: ownerData.emoji,
      createdAt: now,
    });

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.householdName,
      ownerId,
      plan: "starter",
      createdAt: now,
    });

    // Create membership for owner
    await ctx.db.insert("memberships", {
      userId: ownerId,
      workspaceId,
      role: "owner",
      createdAt: now,
    });

    // Create calendar
    await ctx.db.insert("calendars", {
      workspaceId,
      provider: "convex",
      externalId: `household-${workspaceId}`,
      syncStatus: "ready",
      name: `${args.householdName} Calendar`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
    });

    // Create additional members
    for (let i = 1; i < args.members.length; i++) {
      const member = args.members[i];
      const userId = await ctx.db.insert("users", {
        name: member.name,
        email: `${member.name.toLowerCase().replace(/\s+/g, ".")}@household.local`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
        color: member.color,
        avatarEmoji: member.emoji,
        createdAt: now,
      });

      await ctx.db.insert("memberships", {
        userId,
        workspaceId,
        role: "member",
        createdAt: now,
      });
    }

    return { workspaceId };
  },
});

export const addMember = mutation({
  args: {
    name: v.string(),
    emoji: v.optional(v.string()),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspaces").first();
    if (!workspace) throw new Error("No household found. Set up a household first.");

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: `${args.name.toLowerCase().replace(/\s+/g, ".")}@household.local`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
      color: args.color,
      avatarEmoji: args.emoji,
      createdAt: now,
    });

    await ctx.db.insert("memberships", {
      userId,
      workspaceId: workspace._id,
      role: "member",
      createdAt: now,
    });

    return { userId };
  },
});

export const removeMember = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find and delete membership
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const m of memberships) {
      if (m.role === "owner") throw new Error("Cannot remove the household owner.");
      await ctx.db.delete(m._id);
    }

    await ctx.db.delete(args.userId);
  },
});
