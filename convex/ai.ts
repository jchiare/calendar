"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";

// Parse natural language time expressions
function parseTime(text: string): { hour: number; minute: number } | null {
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i,
    /(\d{1,2})\s*(am|pm)/i,
    /(\d{1,2}):(\d{2})/,
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

  return today;
}

// Extract event title by removing time-related words
function extractTitle(text: string): string {
  let title = text
    .replace(/^(add|create|schedule|set up|book|make)\s+/i, '')
    .replace(/^(a|an)\s+/i, '');

  title = title
    .replace(/\b(at|for|on|from|to)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/\b(tomorrow|today|next\s+\w+day)\b/gi, '')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');

  title = title
    .replace(/^(meeting\s+to|to)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (title.length < 3) {
    const match = text.match(/(?:to|for)\s+(.+?)(?:\s+at|\s+on|$)/i);
    if (match) {
      title = match[1].trim();
    } else {
      title = 'New event';
    }
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

// Parse a natural language command using regex (fallback)
function parseCommand(message: string): {
  action: 'create' | 'unknown';
  title?: string;
  date?: Date;
  startTime?: { hour: number; minute: number };
  duration?: number;
} {
  const lowerMessage = message.toLowerCase();

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
      startTime: time || { hour: 12, minute: 0 },
      duration: 60,
    };
  }

  return { action: 'unknown' };
}

function regexFallback(message: string): {
  success: boolean;
  message: string;
  event?: { title: string; start: number; end: number };
} {
  const parsed = parseCommand(message);

  if (parsed.action === 'create' && parsed.title && parsed.date && parsed.startTime) {
    const startDate = new Date(parsed.date);
    startDate.setHours(parsed.startTime.hour, parsed.startTime.minute, 0, 0);
    const start = startDate.getTime();

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + (parsed.duration || 60));
    const end = endDate.getTime();

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
      event: { title: parsed.title, start, end },
    };
  }

  return {
    success: false,
    message: "I didn't understand that command. Try something like:\n• \"Add 3pm meeting to take out trash\"\n• \"Schedule dentist appointment at 2:30pm tomorrow\"\n• \"Create team standup at 9am on Monday\"",
  };
}

export const processMessage = action({
  args: {
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; event?: { title: string; start: number; end: number } }> => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Fallback to regex parsing
      const result = regexFallback(args.message);
      if (result.success && result.event) {
        await ctx.runMutation(internal.aiMutations.createEventFromAI, {
          title: result.event.title,
          start: result.event.start,
          end: result.event.end,
        });
      }
      return result;
    }

    try {
      const openai = new OpenAI({ apiKey });

      const today = new Date();
      const todayStr = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a calendar assistant. Today is ${todayStr}. Extract structured event data from the user's message. Respond ONLY with a JSON object (no markdown, no code fences) with these fields:
- "action": "create" if the user wants to add/create/schedule an event, otherwise "unknown"
- "title": the event title (string)
- "date": the date in YYYY-MM-DD format
- "startHour": start hour in 24h format (number)
- "startMinute": start minute (number)
- "endHour": end hour in 24h format (number)
- "endMinute": end minute (number)
- "description": optional description (string or null)

If no end time is specified, default to 1 hour after start. If no time is specified, default to 12:00. "tomorrow" means the day after today. "next Monday" means the coming Monday.`
          },
          { role: "user", content: args.message }
        ],
        temperature: 0,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("Empty response from OpenAI");

      const parsed = JSON.parse(content);

      if (parsed.action === 'create' && parsed.title && parsed.date) {
        const [year, month, day] = parsed.date.split('-').map(Number);
        const startHour = parsed.startHour ?? 12;
        const startMinute = parsed.startMinute ?? 0;
        const endHour = parsed.endHour ?? startHour + 1;
        const endMinute = parsed.endMinute ?? 0;
        const startDate = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
        const endDate = new Date(year, month - 1, day, endHour, endMinute, 0, 0);

        const start = startDate.getTime();
        const end = endDate.getTime();

        await ctx.runMutation(internal.aiMutations.createEventFromAI, {
          title: parsed.title,
          description: parsed.description || undefined,
          start,
          end,
        });

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
          event: { title: parsed.title, start, end },
        };
      }

      return {
        success: false,
        message: "I didn't understand that command. Try something like:\n• \"Add 3pm meeting to take out trash\"\n• \"Schedule dentist appointment at 2:30pm tomorrow\"\n• \"Create team standup at 9am on Monday\"",
      };
    } catch {
      // Fallback to regex if OpenAI fails
      const result = regexFallback(args.message);
      if (result.success && result.event) {
        await ctx.runMutation(internal.aiMutations.createEventFromAI, {
          title: result.event.title,
          start: result.event.start,
          end: result.event.end,
        });
      }
      return result;
    }
  },
});
