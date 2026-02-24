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
  memberIds?: string[];
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
    householdMembers: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
        })
      )
    ),
    currentUserName: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<AIResponse> => {
    // timezoneOffset: minutes from UTC (e.g. 480 for PST).
    // Server runs in UTC, so we adjust timestamps to match the user's local time.
    const tzOffset = args.timezoneOffset ?? 0;
    const memberNames = (args.householdMembers ?? []).map((m) => m.name);
    const memberNameToId = new Map(
      (args.householdMembers ?? []).map((m) => [m.name.toLowerCase(), m.id])
    );
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        type: "message",
        message: "Please set OPENAI_API_KEY in your Convex environment to use the AI assistant.",
      };
    }

    try {
      const client = new OpenAI({ apiKey });

      const userLocalNow = getUserLocalNow(Date.now(), tzOffset);
      const todayStr = formatUserLocalDate(userLocalNow);
      const utcOffsetLabel = formatUtcOffsetFromTimezoneOffset(tzOffset);

      const householdSection = memberNames.length > 0
        ? `\nHOUSEHOLD MEMBERS: ${memberNames.join(", ")}
The person typing is${args.currentUserName ? ` ${args.currentUserName}` : " the first member"}.

MEMBER ASSIGNMENT (assignedMembers field):
- Always return assignedMembers as an array of household member names that this event involves.
- If the message mentions a household member by name (e.g., "${memberNames[0] ?? "Jamie"}'s dentist"), assign to that member: ["${memberNames[0] ?? "Jamie"}"].
- If the message says "coffee with ${memberNames[1] ?? "someone"}" and ${memberNames[1] ?? "someone"} IS a household member, assign to BOTH the current user and that member: ["${args.currentUserName ?? memberNames[0] ?? "User"}", "${memberNames[1] ?? "someone"}"].
- If the message mentions a name that is NOT a household member (e.g., "coffee with George" where George is not in the household), that person is an external attendee. Assign only to the current user: ["${args.currentUserName ?? memberNames[0] ?? "User"}"]. Put the external person in the attendees field.
- If the event seems like it's for the whole family (e.g., "family dinner", "movie night"), assign to ALL household members: [${memberNames.map((n) => `"${n}"`).join(", ")}].
- For ambiguous events with no specific person mentioned (e.g., "dentist 2pm", "workout"), assign to the current user: ["${args.currentUserName ?? memberNames[0] ?? "User"}"].
- IMPORTANT: Only use exact household member names from the list above. Never invent member names.\n`
        : "";

      const systemPrompt = `You are a smart calendar assistant for a household. User local date is ${todayStr} (${utcOffsetLabel}).
${householdSection}
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
- Relative dates ("today", "tomorrow", "next Tuesday") must be interpreted from the user's local date above, not server date.
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
              assignedMembers: {
                type: ["array", "null"],
                items: { type: "string" },
                description:
                  "Household member names this event is for. Use exact names from the household list. null if no household members are known.",
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
              "assignedMembers",
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
            assignedMembers: string[] | null;
          };

          // Map assigned member names → IDs
          const resolvedMemberIds: string[] = [];
          if (parsedArgs.assignedMembers) {
            for (const name of parsedArgs.assignedMembers) {
              const id = memberNameToId.get(name.toLowerCase());
              if (id) resolvedMemberIds.push(id);
            }
          }
          // Fallback: if AI didn't assign anyone but we have members, assign to current user
          if (resolvedMemberIds.length === 0 && args.householdMembers && args.householdMembers.length > 0) {
            const currentName = args.currentUserName?.toLowerCase();
            const fallbackId = currentName
              ? memberNameToId.get(currentName) ?? args.householdMembers[0].id
              : args.householdMembers[0].id;
            resolvedMemberIds.push(fallbackId);
          }

          const normalizedDate =
            inferRelativeDateFromMessage(args.message, userLocalNow) ??
            parsedArgs.date;
          const [year, month, day] = normalizedDate.split("-").map(Number);

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
                  memberIds: resolvedMemberIds.length > 0 ? resolvedMemberIds : undefined,
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

            const endTotalMinutes =
              parsedArgs.startHour * 60 +
              parsedArgs.startMinute +
              parsedArgs.durationMinutes;
            const endHour = Math.floor(endTotalMinutes / 60) % 24;
            const endMin = endTotalMinutes % 60;

            const recurrenceId = `recurring-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            let msg = `Adding ${parsedArgs.title} every ${dayRange}, ${fmtHr(parsedArgs.startHour, parsedArgs.startMinute)}–${fmtHr(endHour, endMin)} for ${weeks} week${weeks === 1 ? "" : "s"} (${proposals.length} events).`;
            if (parsedArgs.location) {
              msg += ` Location: ${parsedArgs.location}.`;
            }

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
            memberIds: resolvedMemberIds.length > 0 ? resolvedMemberIds : undefined,
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

function getUserLocalNow(nowMs: number, timezoneOffsetMinutes: number): Date {
  // getTimezoneOffset is UTC - local (e.g. PST = +480).
  // Shift "now" so UTC getters represent the user's local clock.
  return new Date(nowMs - timezoneOffsetMinutes * 60 * 1000);
}

function formatUserLocalDate(localDate: Date): string {
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][localDate.getUTCDay()];
  const month = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][localDate.getUTCMonth()];
  const day = localDate.getUTCDate();
  const year = localDate.getUTCFullYear();
  return `${weekday}, ${month} ${day}, ${year}`;
}

function formatUtcOffsetFromTimezoneOffset(timezoneOffsetMinutes: number): string {
  const localOffset = -timezoneOffsetMinutes; // local - UTC
  const sign = localOffset >= 0 ? "+" : "-";
  const abs = Math.abs(localOffset);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function inferRelativeDateFromMessage(
  message: string,
  userLocalNow: Date
): string | null {
  const msg = message.toLowerCase();
  if (/\btomorrow\b/.test(msg)) {
    const nextDay = new Date(userLocalNow);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return formatYmdFromLocalDate(nextDay);
  }
  if (/\btoday\b/.test(msg) || /\btonight\b/.test(msg)) {
    return formatYmdFromLocalDate(userLocalNow);
  }
  return null;
}

function formatYmdFromLocalDate(localDate: Date): string {
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(localDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
