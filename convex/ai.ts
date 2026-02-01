import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

// Parse natural language time expressions
function parseTime(text: string): { hour: number; minute: number } | null {
  // Match patterns like "3pm", "3:30pm", "15:00", "3 pm", "3:30 PM"
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i,  // 3:30pm, 3:30 PM
    /(\d{1,2})\s*(am|pm)/i,          // 3pm, 3 PM
    /(\d{1,2}):(\d{2})/,             // 15:00 (24-hour)
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = match[2] && !match[2].match(/am|pm/i) ? parseInt(match[2], 10) : 0;
      const meridiem = match[3] || match[2];

      if (meridiem && typeof meridiem === 'string') {
        if (meridiem.toLowerCase() === 'pm' && hour !== 12) {
          hour += 12;
        } else if (meridiem.toLowerCase() === 'am' && hour === 12) {
          hour = 0;
        }
      }

      return { hour, minute };
    }
  }

  return null;
}

// Parse date expressions like "tomorrow", "next monday", "feb 15"
function parseDate(text: string): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lowerText = text.toLowerCase();

  if (lowerText.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lowerText.includes(days[i])) {
      const targetDay = i;
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const date = new Date(today);
      date.setDate(today.getDate() + daysUntil);
      return date;
    }
  }

  // Default to today
  return today;
}

// Extract event title by removing time-related words
function extractTitle(text: string): string {
  // Remove common prefixes
  let title = text
    .replace(/^(add|create|schedule|set up|book|make)\s+/i, '')
    .replace(/^(a|an)\s+/i, '');

  // Remove time expressions
  title = title
    .replace(/\b(at|for|on|from|to)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/\b(tomorrow|today|next\s+\w+day)\b/gi, '')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');

  // Clean up common filler words at the start
  title = title
    .replace(/^(meeting\s+to|to)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If the remaining title is empty or very short, try to extract meaningful content
  if (title.length < 3) {
    // Try to get something meaningful from the original
    const match = text.match(/(?:to|for)\s+(.+?)(?:\s+at|\s+on|$)/i);
    if (match) {
      title = match[1].trim();
    } else {
      title = 'New event';
    }
  }

  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// Parse a natural language command into structured event data
function parseCommand(message: string): {
  action: 'create' | 'unknown';
  title?: string;
  date?: Date;
  startTime?: { hour: number; minute: number };
  duration?: number; // in minutes
} {
  const lowerMessage = message.toLowerCase();

  // Check for create/add intent
  const createPatterns = [
    /^(add|create|schedule|set up|book|make)/i,
    /meeting|appointment|event|reminder/i,
  ];

  const isCreate = createPatterns.some(p => p.test(lowerMessage));

  if (isCreate) {
    const time = parseTime(message);
    const date = parseDate(message);
    const title = extractTitle(message);

    return {
      action: 'create',
      title,
      date,
      startTime: time || { hour: 12, minute: 0 }, // Default to noon if no time specified
      duration: 60, // Default 1 hour duration
    };
  }

  return { action: 'unknown' };
}

export const processMessage = mutationGeneric({
  args: {
    message: v.string(),
  },
  handler: async (ctx: any, args: { message: string }) => {
    const parsed = parseCommand(args.message);

    if (parsed.action === 'create' && parsed.title && parsed.date && parsed.startTime) {
      // Build start and end timestamps
      const startDate = new Date(parsed.date);
      startDate.setHours(parsed.startTime.hour, parsed.startTime.minute, 0, 0);
      const start = startDate.getTime();

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + (parsed.duration || 60));
      const end = endDate.getTime();

      // Get or create a default calendar
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
        title: parsed.title,
        start,
        end,
        updatedAt: now,
        createdAt: now,
      });

      // Format the response
      const timeStr = startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const dateStr = startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });

      return {
        success: true,
        message: `Created "${parsed.title}" for ${dateStr} at ${timeStr}`,
        event: {
          title: parsed.title,
          start,
          end,
        },
      };
    }

    return {
      success: false,
      message: "I didn't understand that command. Try something like:\n• \"Add 3pm meeting to take out trash\"\n• \"Schedule dentist appointment at 2:30pm tomorrow\"\n• \"Create team standup at 9am on Monday\"",
    };
  },
});
