"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";

// Event proposal returned to the frontend for confirmation
export type EventProposal = {
  title: string;
  start: number;
  end: number;
  location?: string;
  attendees?: string[];
  description?: string;
};

export type AIResponse = {
  type: "create_event" | "create_events" | "message";
  message: string;
  proposal?: EventProposal;
  proposals?: EventProposal[];
  recurrenceId?: string;
};

export const processMessage = action({
  args: {
    message: v.string(),
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.string(),
          content: v.string(),
        })
      )
    ),
    timezoneOffset: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<AIResponse> => {
    // timezoneOffset: minutes from UTC (e.g. 480 for PST).
    // Server runs in UTC, so we adjust timestamps to match the user's local time.
    const tzOffset = args.timezoneOffset ?? 0;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return regexFallback(args.message, tzOffset);
    }

    try {
      const client = new OpenAI({ apiKey });

      const today = new Date();
      const todayStr = today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const systemPrompt = `You are a smart calendar assistant. Today is ${todayStr}.

When the user wants to create an event, use the create_event function. You must infer:

DURATION RULES (apply these based on event type keywords):
- coffee, lunch, drinks → 30 minutes
- meeting, sync, standup → 30 minutes
- dinner, movie → 90 minutes
- workout, gym, run → 60 minutes
- dentist, doctor, appointment → 60 minutes
- "quick chat", "quick call" → 15 minutes
- 1:1, one-on-one → 30 minutes
- workshop, training → 120 minutes
- Default (unrecognized) → 60 minutes

TIME INFERENCE:
- "morning" → 9:00 AM
- "afternoon" → 2:00 PM
- "evening" → 6:00 PM
- If just a number like "3" or "at 3", infer PM for typical events
- "tomorrow" means the next day from today
- "next Tuesday" means the coming Tuesday

SMART PARSING:
- "with George" → attendee "George"
- "at Blue Bottle" → location "Blue Bottle"
- Capitalize titles properly (e.g., "coffee with george" → "Coffee with George")

Keep your responses very short and friendly. Don't be overly formal.`;

      // Build input items for multi-turn context
      const input: OpenAI.Responses.ResponseInputItem[] = [];
      if (args.conversationHistory) {
        for (const msg of args.conversationHistory) {
          if (msg.role === "user" || msg.role === "assistant") {
            input.push({
              type: "message",
              role: msg.role as "user" | "assistant",
              content: msg.content,
            });
          }
        }
      }
      input.push({ type: "message", role: "user", content: args.message });

      const tools: OpenAI.Responses.Tool[] = [
        {
          type: "function",
          name: "create_event",
          description:
            "Create a calendar event. Returns a proposal for user confirmation.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description:
                  "Event title, properly capitalized (e.g., 'Coffee with George')",
              },
              date: {
                type: "string",
                description: "Date in YYYY-MM-DD format",
              },
              startHour: {
                type: "number",
                description: "Start hour in 24h format (0-23)",
              },
              startMinute: {
                type: "number",
                description: "Start minute (0-59)",
              },
              durationMinutes: {
                type: "number",
                description:
                  "Duration in minutes, inferred from event type",
              },
              location: {
                type: ["string", "null"],
                description:
                  "Location if mentioned (e.g., 'Blue Bottle'), or null",
              },
              attendees: {
                type: ["array", "null"],
                items: { type: "string" },
                description:
                  "Names of people mentioned (e.g., ['George']), or null",
              },
              description: {
                type: ["string", "null"],
                description: "Optional notes or description, or null",
              },
            },
            required: [
              "title",
              "date",
              "startHour",
              "startMinute",
              "durationMinutes",
              "location",
              "attendees",
              "description",
            ],
            additionalProperties: false,
          },
          strict: true,
        },
      ];

      const response = await client.responses.create({
        model: "gpt-5.2",
        instructions: systemPrompt,
        input,
        tools,
        store: false,
      });

      // Process output items
      for (const item of response.output) {
        if (item.type === "function_call" && item.name === "create_event") {
          const parsedArgs = JSON.parse(item.arguments) as {
            title: string;
            date: string;
            startHour: number;
            startMinute: number;
            durationMinutes: number;
            location: string | null;
            attendees: string[] | null;
            description: string | null;
          };

          const [year, month, day] = parsedArgs.date.split("-").map(Number);
          // Build timestamp in UTC then adjust for user's timezone
          const startMs = Date.UTC(year, month - 1, day, parsedArgs.startHour, parsedArgs.startMinute)
            + tzOffset * 60 * 1000;
          const endMs = startMs + parsedArgs.durationMinutes * 60 * 1000;

          const proposal: EventProposal = {
            title: parsedArgs.title,
            start: startMs,
            end: endMs,
            location: parsedArgs.location ?? undefined,
            attendees: parsedArgs.attendees ?? undefined,
            description: parsedArgs.description ?? undefined,
          };

          const durationLabel =
            parsedArgs.durationMinutes >= 60
              ? `${parsedArgs.durationMinutes / 60}hr`
              : `${parsedArgs.durationMinutes} min`;

          let message = formatTimestamp(startMs, endMs, durationLabel);
          if (parsedArgs.location) {
            message += ` · ${parsedArgs.location}`;
          }

          return {
            type: "create_event",
            message,
            proposal,
          };
        }
      }

      // Plain text response
      if (response.output_text) {
        return {
          type: "message",
          message: response.output_text,
        };
      }

      return {
        type: "message",
        message: "I'm not sure what you'd like to do. Try something like \"coffee with George tomorrow at 3\".",
      };
    } catch {
      return regexFallback(args.message, tzOffset);
    }
  },
});

// Format timestamps into a readable message (using UTC to avoid server TZ issues)
function formatTimestamp(startMs: number, endMs: number, durationLabel: string): string {
  const s = new Date(startMs);
  const e = new Date(endMs);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.getUTCDay()];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[s.getUTCMonth()];
  const day = s.getUTCDate();

  const fmtTime = (d: Date) => {
    let h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return `${weekday}, ${month} ${day} ${fmtTime(s)}–${fmtTime(e)} · ${durationLabel}`;
}

// Parse a single time like "9am", "4:30pm", "14" into 24h hour and minute
function parseTime(hourStr: string, minuteStr: string | undefined, meridiemStr: string | undefined): { hour: number; minute: number } {
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr && !meridiemStr?.match(/am|pm/i) ? parseInt(minuteStr, 10) : 0;
  if (meridiemStr) {
    if (meridiemStr.toLowerCase() === "pm" && hour !== 12) hour += 12;
    else if (meridiemStr.toLowerCase() === "am" && hour === 12) hour = 0;
  } else if (hour < 7) {
    hour += 12;
  }
  return { hour, minute };
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const RECURRING_WEEKS = 8;

// Map abbreviated day names to day-of-week index (0=Sun .. 6=Sat)
// su=Sun, m=Mon, t/tu=Tue, w=Wed, th=Thu, f=Fri, sa=Sat
const DAY_ABBREV_MAP: Record<string, number> = {
  su: 0, m: 1, t: 2, tu: 2, w: 3, th: 4, f: 5, sa: 6,
};
// Regex fragment matching abbreviated day names (longer alternatives first)
const DAY_ABBREV_RE = "su|sa|th|tu|m|t|w|f";

// Regex fallback when no API key is configured
function regexFallback(message: string, tzOffset: number): AIResponse {
  const lowerMessage = message.toLowerCase();

  // Check if it looks like an event creation request
  const createPatterns = [
    /^(add|create|schedule|set up|book|make)/i,
    /meeting|appointment|event|reminder|coffee|lunch|dinner|workout|gym|dentist|therapy|class|lesson|session|preschool|school|daycare/i,
  ];

  // Match abbreviated day ranges like "m-f", "t to f", "tu-th"
  const abbrevDayRangeRe = new RegExp(`(?:^|\\s)(${DAY_ABBREV_RE})\\s*(?:[-–]|\\s+to\\s+)\\s*(${DAY_ABBREV_RE})(?:\\s|$|,)`, "i");

  const hasDayAndTime =
    (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|weekdays?)\b/i.test(lowerMessage) ||
     abbrevDayRangeRe.test(lowerMessage)) &&
    /\d{1,2}(:\d{2})?\s*(am|pm)\b|\bat\s+\d{1,2}/i.test(lowerMessage);

  const isCreate = createPatterns.some((p) => p.test(lowerMessage)) || hasDayAndTime;

  if (!isCreate) {
    return {
      type: "message",
      message:
        "Try describing an event, like \"coffee with George tomorrow at 3\" or \"dentist appointment Friday 10am\".",
    };
  }

  // Get "today" in the user's local timezone
  const nowMs = Date.now();
  const localNowMs = nowMs - tzOffset * 60 * 1000;
  const localNow = new Date(localNowMs);
  const todayYear = localNow.getUTCFullYear();
  const todayMonth = localNow.getUTCMonth();
  const todayDay = localNow.getUTCDate();
  const localDayOfWeek = localNow.getUTCDay();

  // --- Parse time range (e.g. "9am to 4pm", "9:30am-4pm") ---
  let startHour = 12, startMinute = 0, endHour = -1, endMinute = 0;
  const timeRangeMatch = lowerMessage.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
  );
  if (timeRangeMatch) {
    const start = parseTime(timeRangeMatch[1], timeRangeMatch[2], timeRangeMatch[3]);
    const end = parseTime(timeRangeMatch[4], timeRangeMatch[5], timeRangeMatch[6]);
    startHour = start.hour;
    startMinute = start.minute;
    endHour = end.hour;
    endMinute = end.minute;
  } else {
    // Single time
    const timeMatch =
      lowerMessage.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i) ||
      lowerMessage.match(/(\d{1,2})\s*(am|pm)/i) ||
      lowerMessage.match(/at\s+(\d{1,2})(?::(\d{2}))?(?!\d)/i);
    if (timeMatch) {
      const t = parseTime(timeMatch[1], timeMatch[2], timeMatch[3] || timeMatch[2]);
      startHour = t.hour;
      startMinute = t.minute;
    }
  }

  // --- Parse day range (e.g. "monday to friday", "m-f", "weekdays") ---
  let recurringDays: number[] | null = null;
  const dayRangeMatch = lowerMessage.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\s*(?:to|through|-)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/i
  );
  // Also try abbreviated day ranges: "m-f", "t to f", "tu-th", etc.
  const abbrevMatch = !dayRangeMatch
    ? lowerMessage.match(new RegExp(`(?:^|\\s)(${DAY_ABBREV_RE})\\s*(?:[-–]|\\s+to\\s+)\\s*(${DAY_ABBREV_RE})(?:\\s|$|,)`, "i"))
    : null;
  if (dayRangeMatch) {
    const startDay = DAY_NAMES.indexOf(dayRangeMatch[1].toLowerCase());
    const endDay = DAY_NAMES.indexOf(dayRangeMatch[2].toLowerCase());
    if (startDay >= 0 && endDay >= 0) {
      recurringDays = [];
      let d = startDay;
      while (true) {
        recurringDays.push(d);
        if (d === endDay) break;
        d = (d + 1) % 7;
      }
    }
  } else if (abbrevMatch) {
    const startDay = DAY_ABBREV_MAP[abbrevMatch[1].toLowerCase()];
    const endDay = DAY_ABBREV_MAP[abbrevMatch[2].toLowerCase()];
    if (startDay !== undefined && endDay !== undefined) {
      recurringDays = [];
      let d = startDay;
      while (true) {
        recurringDays.push(d);
        if (d === endDay) break;
        d = (d + 1) % 7;
      }
    }
  } else if (/\bweekdays?\b/i.test(lowerMessage)) {
    recurringDays = [1, 2, 3, 4, 5]; // Mon-Fri
  }

  // Infer duration (only if no explicit end time)
  let durationMinutes: number | null = null;
  if (endHour < 0) {
    durationMinutes = 60;
    if (/coffee|lunch|drinks/i.test(lowerMessage)) durationMinutes = 30;
    else if (/meeting|sync|standup|1:1/i.test(lowerMessage)) durationMinutes = 30;
    else if (/dinner|movie/i.test(lowerMessage)) durationMinutes = 90;
    else if (/workout|gym|run/i.test(lowerMessage)) durationMinutes = 60;
    else if (/quick\s*(chat|call)/i.test(lowerMessage)) durationMinutes = 15;
    else if (/workshop|training/i.test(lowerMessage)) durationMinutes = 120;
    endHour = startHour + Math.floor(durationMinutes / 60);
    endMinute = startMinute + (durationMinutes % 60);
    if (endMinute >= 60) { endHour++; endMinute -= 60; }
  }

  const totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  const durationLabel = totalMinutes >= 60
    ? `${(totalMinutes / 60).toFixed(totalMinutes % 60 === 0 ? 0 : 1)}hr`
    : `${totalMinutes} min`;

  // --- Extract title ---
  let title = message
    .replace(/^(add|create|schedule|set up|book|make)\s+/i, "")
    .replace(/^(a|an)\s+/i, "")
    // Strip time range ("9am to 4pm")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, "")
    // Strip single times ("9am", "at 3pm")
    .replace(/\b(at|for|on|from|to)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, "")
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, "")
    // Strip day range ("monday to fridays", "m-f", "t to f")
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\s*(?:to|through|-)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gi, "")
    .replace(new RegExp(`(?:^|\\s)(${DAY_ABBREV_RE})\\s*(?:[-–]|\\s+to\\s+)\\s*(${DAY_ABBREV_RE})(?=\\s|$|,)`, "gi"), " ")
    .replace(/\bweekdays?\b/gi, "")
    // Strip individual day names and date words
    .replace(/\b(tomorrow|today|next\s+\w+day)\b/gi, "")
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (title.length < 3) title = "New event";
  title = title.replace(/\b\w/g, (c) => c.toUpperCase());

  // --- Build proposals ---
  if (recurringDays && recurringDays.length > 0) {
    // Recurring: generate events for each matching day over RECURRING_WEEKS
    const proposals: EventProposal[] = [];

    for (let week = 0; week < RECURRING_WEEKS; week++) {
      for (const dayNum of recurringDays) {
        // Find the next occurrence of this day of the week
        let daysUntil = dayNum - localDayOfWeek;
        if (daysUntil <= 0) daysUntil += 7;
        daysUntil += week * 7;

        const startMs = Date.UTC(todayYear, todayMonth, todayDay + daysUntil, startHour, startMinute)
          + tzOffset * 60 * 1000;
        const endMs = Date.UTC(todayYear, todayMonth, todayDay + daysUntil, endHour, endMinute)
          + tzOffset * 60 * 1000;

        proposals.push({ title, start: startMs, end: endMs });
      }
    }

    // Sort by start time
    proposals.sort((a, b) => a.start - b.start);

    const dayLabels = recurringDays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]);
    const dayRange = dayLabels.length > 2
      ? `${dayLabels[0]}–${dayLabels[dayLabels.length - 1]}`
      : dayLabels.join(", ");

    const fmtHr = (h: number, m: number) => {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    };

    const recurrenceId = `recurring-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const msg = `Got it! I'll add ${title} every ${dayRange}, ${fmtHr(startHour, startMinute)}–${fmtHr(endHour, endMinute)} for ${RECURRING_WEEKS} weeks (${proposals.length} events). You can delete any single one later, or remove all future ones at once.`;

    return {
      type: "create_events",
      message: msg,
      proposal: proposals[0],
      proposals,
      recurrenceId,
    };
  }

  // --- Single event ---
  let eventYear = todayYear, eventMonth = todayMonth, eventDay = todayDay;

  if (lowerMessage.includes("tomorrow")) {
    const d = new Date(Date.UTC(eventYear, eventMonth, eventDay + 1));
    eventYear = d.getUTCFullYear();
    eventMonth = d.getUTCMonth();
    eventDay = d.getUTCDate();
  } else {
    for (let i = 0; i < DAY_NAMES.length; i++) {
      if (lowerMessage.includes(DAY_NAMES[i])) {
        let daysUntil = i - localDayOfWeek;
        if (daysUntil <= 0) daysUntil += 7;
        const d = new Date(Date.UTC(eventYear, eventMonth, eventDay + daysUntil));
        eventYear = d.getUTCFullYear();
        eventMonth = d.getUTCMonth();
        eventDay = d.getUTCDate();
        break;
      }
    }
  }

  const startMs = Date.UTC(eventYear, eventMonth, eventDay, startHour, startMinute)
    + tzOffset * 60 * 1000;
  const endMs = Date.UTC(eventYear, eventMonth, eventDay, endHour, endMinute)
    + tzOffset * 60 * 1000;

  return {
    type: "create_event",
    message: formatTimestamp(startMs, endMs, durationLabel),
    proposal: {
      title,
      start: startMs,
      end: endMs,
    },
  };
}
