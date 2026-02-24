import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    timezone: v.string(),
    color: v.optional(v.string()),
    avatarEmoji: v.optional(v.string()),
    preferences: v.optional(
      v.object({
        weekStart: v.optional(v.string()),
        quietHours: v.optional(v.array(v.string())),
        defaultBuffers: v.optional(v.number())
      })
    ),
    createdAt: v.number()
  }).index("by_email", ["email"]),
  workspaces: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    plan: v.optional(v.string()),
    createdAt: v.number()
  }).index("by_owner", ["ownerId"]),
  memberships: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: v.string(),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"]),
  calendars: defineTable({
    workspaceId: v.id("workspaces"),
    provider: v.string(),
    externalId: v.string(),
    syncStatus: v.optional(v.string()),
    name: v.string(),
    timezone: v.string()
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_provider_external", ["provider", "externalId"]),
  events: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    calendarId: v.id("calendars"),
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    location: v.optional(v.string()),
    attendees: v.optional(
      v.array(
        v.object({
          email: v.string(),
          name: v.optional(v.string()),
          status: v.optional(v.string())
        })
      )
    ),
    createdBy: v.optional(v.id("users")),
    participantIds: v.optional(v.array(v.id("users"))),
    recurrence: v.optional(v.string()),
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
    createdAt: v.number()
  })
    .index("by_calendar", ["calendarId"])
    .index("by_start", ["start"]),
  integrations: defineTable({
    workspaceId: v.id("workspaces"),
    provider: v.string(),
    tokens: v.optional(v.any()),
    scopes: v.array(v.string()),
    lastSyncedAt: v.optional(v.number()),
    status: v.optional(v.string())
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_provider", ["provider"]),
  aiThreads: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        createdAt: v.number()
      })
    ),
    toolCalls: v.optional(v.array(v.any())),
    createdAt: v.number()
  }).index("by_workspace", ["workspaceId"]),
  automationRules: defineTable({
    workspaceId: v.id("workspaces"),
    trigger: v.any(),
    action: v.any(),
    enabled: v.boolean(),
    createdAt: v.number()
  }).index("by_workspace", ["workspaceId"])
});
