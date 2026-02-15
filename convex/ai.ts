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

const RECURRING_WEEKS = 8;

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
      return {
        type: "message",
        message: "Please set OPENAI_API_KEY in your Convex environment to use the AI assistant.",
      };
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
- preschool, school, daycare, camp → use explicit end time if given, otherwise full day (7hr)
- Default (unrecognized) → 60 minutes
- IMPORTANT: If user gives an explicit time range like "9am to 4pm", use that to calculate duration. Don't use the defaults above.

TIME INFERENCE:
- "morning" → 9:00 AM
- "afternoon" → 2:00 PM
- "evening" → 6:00 PM
- If just a number like "3" or "at 3", infer PM for typical events
- "tomorrow" means the next day from today
- "next Tuesday" means the coming Tuesday

RECURRING EVENTS:
- If the user mentions multiple days like "monday to friday", "m-f", "weekdays", "t-f", "every tuesday and thursday", etc., set recurringDays to the array of day numbers (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat).
- Day abbreviations: m=Mon, t/tu=Tue, w=Wed, th=Thu, f=Fri, sa=Sat, su=Sun
- "m-f" or "monday to friday" or "weekdays" → [1,2,3,4,5]
- "t-f" or "tuesday to friday" → [2,3,4,5]
- "MWF" or "monday wednesday friday" → [1,3,5]
- For recurring events, set the date to the FIRST occurrence (next matching day from today).
- Set recurringWeeks to 8 by default unless the user specifies otherwise.

SMART PARSING:
- "with George" → attendee "George"
- "at Blue Bottle" or "laurel hill" after an event type → location "Blue Bottle" / "Laurel Hill"
- Separate the location from the event title. E.g., "ellie preschool laurel hill" → title "Ellie Preschool", location "Laurel Hill"
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
            "Create a calendar event (single or recurring). Returns a proposal for user confirmation.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description:
                  "Event title, properly capitalized (e.g., 'Coffee with George', 'Ellie Preschool')",
              },
              date: {
                type: "string",
                description: "Start date in YYYY-MM-DD format. For recurring events, this is the first occurrence.",
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
                  "Duration in minutes. Use explicit end time if given (e.g., '9am to 4pm' = 420 min), otherwise infer from event type.",
              },
              location: {
                type: ["string", "null"],
                description:
                  "Location if mentioned (e.g., 'Laurel Hill', 'Blue Bottle'), or null. Separate from title.",
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
              recurringDays: {
                type: ["array", "null"],
                items: { type: "number" },
                description:
                  "For recurring events: array of day-of-week numbers (0=Sun, 1=Mon, ..., 6=Sat). E.g., [1,2,3,4,5] for Mon-Fri. null for single events.",
              },
              recurringWeeks: {
                type: ["number", "null"],
                description:
                  "For recurring events: number of weeks to repeat. Default 8. null for single events.",
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
              "recurringDays",
              "recurringWeeks",
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
            recurringDays: number[] | null;
            recurringWeeks: number | null;
          };

          const [year, month, day] = parsedArgs.date.split("-").map(Number);

          const durationLabel =
            parsedArgs.durationMinutes >= 60
              ? `${(parsedArgs.durationMinutes / 60).toFixed(parsedArgs.durationMinutes % 60 === 0 ? 0 : 1)}hr`
              : `${parsedArgs.durationMinutes} min`;

          // --- Recurring event ---
          if (parsedArgs.recurringDays && parsedArgs.recurringDays.length > 0) {
            const weeks = parsedArgs.recurringWeeks ?? RECURRING_WEEKS;
            const proposals: EventProposal[] = [];

            // Find first date's day of week to calculate offsets
            const firstDate = new Date(Date.UTC(year, month - 1, day));
            const firstDow = firstDate.getUTCDay();

            for (let week = 0; week < weeks; week++) {
              for (const dayNum of parsedArgs.recurringDays) {
                let daysOffset = dayNum - firstDow;
                if (daysOffset < 0) daysOffset += 7;
                daysOffset += week * 7;

                const startMs = Date.UTC(year, month - 1, day + daysOffset, parsedArgs.startHour, parsedArgs.startMinute)
                  + tzOffset * 60 * 1000;
                const endMs = startMs + parsedArgs.durationMinutes * 60 * 1000;

                proposals.push({
                  title: parsedArgs.title,
                  start: startMs,
                  end: endMs,
                  location: parsedArgs.location ?? undefined,
                  attendees: parsedArgs.attendees ?? undefined,
                  description: parsedArgs.description ?? undefined,
                });
              }
            }

            proposals.sort((a, b) => a.start - b.start);

            const dayLabels = parsedArgs.recurringDays
              .sort((a, b) => a - b)
              .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]);
            const dayRange = dayLabels.length > 2
              ? `${dayLabels[0]}–${dayLabels[dayLabels.length - 1]}`
              : dayLabels.join(", ");

            const fmtHr = (h: number, m: number) => {
              const ampm = h >= 12 ? "PM" : "AM";
              const h12 = h % 12 || 12;
              return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
            };

            const endHour = parsedArgs.startHour + Math.floor(parsedArgs.durationMinutes / 60);
            const endMin = parsedArgs.startMinute + (parsedArgs.durationMinutes % 60);

            const recurrenceId = `recurring-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            let msg = `Got it! I'll add ${parsedArgs.title} every ${dayRange}, ${fmtHr(parsedArgs.startHour, parsedArgs.startMinute)}–${fmtHr(endHour, endMin)} for ${weeks} weeks (${proposals.length} events).`;
            if (parsedArgs.location) {
              msg += ` Location: ${parsedArgs.location}.`;
            }
            msg += ` You can delete any single one later, or remove all future ones at once.`;

            return {
              type: "create_events",
              message: msg,
              proposal: proposals[0],
              proposals,
              recurrenceId,
            };
          }

          // --- Single event ---
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      return {
        type: "message",
        message: `Something went wrong talking to the AI: ${errorMsg}. Please try again.`,
      };
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
