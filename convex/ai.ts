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
  type: "create_event" | "message";
  message: string;
  proposal?: EventProposal;
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
  },
  handler: async (_ctx, args): Promise<AIResponse> => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return regexFallback(args.message);
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

      // Build message history for multi-turn context
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
      ];
      if (args.conversationHistory) {
        for (const msg of args.conversationHistory) {
          if (msg.role === "user" || msg.role === "assistant") {
            messages.push({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            });
          }
        }
      }
      messages.push({ role: "user", content: args.message });

      const tools: OpenAI.ChatCompletionTool[] = [
        {
          type: "function",
          function: {
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
                  type: "string",
                  description:
                    "Location if mentioned (e.g., 'Blue Bottle')",
                },
                attendees: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Names of people mentioned (e.g., ['George'])",
                },
                description: {
                  type: "string",
                  description: "Optional notes or description",
                },
              },
              required: [
                "title",
                "date",
                "startHour",
                "startMinute",
                "durationMinutes",
              ],
            },
          },
        },
      ];

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools,
      });

      const choice = response.choices[0];
      if (!choice?.message) {
        return regexFallback(args.message);
      }

      // Check for tool calls
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        if (toolCall.type === "function" && toolCall.function.name === "create_event") {
          const input = JSON.parse(toolCall.function.arguments) as {
            title: string;
            date: string;
            startHour: number;
            startMinute: number;
            durationMinutes: number;
            location?: string;
            attendees?: string[];
            description?: string;
          };

          const [year, month, day] = input.date.split("-").map(Number);
          const startDate = new Date(
            year,
            month - 1,
            day,
            input.startHour,
            input.startMinute,
            0,
            0
          );
          const endDate = new Date(
            startDate.getTime() + input.durationMinutes * 60 * 1000
          );

          const proposal: EventProposal = {
            title: input.title,
            start: startDate.getTime(),
            end: endDate.getTime(),
            location: input.location,
            attendees: input.attendees,
            description: input.description,
          };

          // Build a friendly message
          const timeStr = startDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          const endTimeStr = endDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          const dateStr = startDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });

          const durationLabel =
            input.durationMinutes >= 60
              ? `${input.durationMinutes / 60}hr`
              : `${input.durationMinutes} min`;

          let message = `${dateStr} ${timeStr}–${endTimeStr} · ${durationLabel}`;
          if (input.location) {
            message += ` · ${input.location}`;
          }

          return {
            type: "create_event",
            message,
            proposal,
          };
        }
      }

      // Plain text response
      if (choice.message.content) {
        return {
          type: "message",
          message: choice.message.content,
        };
      }

      return {
        type: "message",
        message: "I'm not sure what you'd like to do. Try something like \"coffee with George tomorrow at 3\".",
      };
    } catch {
      return regexFallback(args.message);
    }
  },
});

// Regex fallback when no API key is configured
function regexFallback(message: string): AIResponse {
  const lowerMessage = message.toLowerCase();

  // Check if it looks like an event creation request
  const createPatterns = [
    /^(add|create|schedule|set up|book|make)/i,
    /meeting|appointment|event|reminder|coffee|lunch|dinner|workout|gym|dentist/i,
  ];

  const isCreate = createPatterns.some((p) => p.test(lowerMessage));

  if (!isCreate) {
    return {
      type: "message",
      message:
        "Try describing an event, like \"coffee with George tomorrow at 3\" or \"dentist appointment Friday 10am\".",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse date
  let eventDate = new Date(today);
  if (lowerMessage.includes("tomorrow")) {
    eventDate.setDate(eventDate.getDate() + 1);
  } else {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    for (let i = 0; i < days.length; i++) {
      if (lowerMessage.includes(days[i])) {
        const currentDay = eventDate.getDay();
        let daysUntil = i - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        eventDate.setDate(eventDate.getDate() + daysUntil);
        break;
      }
    }
  }

  // Parse time
  let hour = 12;
  let minute = 0;
  const timeMatch =
    lowerMessage.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i) ||
    lowerMessage.match(/(\d{1,2})\s*(am|pm)/i) ||
    lowerMessage.match(/at\s+(\d{1,2})(?::(\d{2}))?(?!\d)/i);
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = timeMatch[2] && !timeMatch[2].match(/am|pm/i)
      ? parseInt(timeMatch[2], 10)
      : 0;
    const meridiem = timeMatch[3] || timeMatch[2];
    if (meridiem && typeof meridiem === "string") {
      if (meridiem.toLowerCase() === "pm" && hour !== 12) hour += 12;
      else if (meridiem.toLowerCase() === "am" && hour === 12) hour = 0;
    } else if (hour < 7) {
      hour += 12; // Assume PM for small numbers without meridiem
    }
  }

  // Infer duration from event type
  let durationMinutes = 60;
  if (/coffee|lunch|drinks/i.test(lowerMessage)) durationMinutes = 30;
  else if (/meeting|sync|standup|1:1/i.test(lowerMessage)) durationMinutes = 30;
  else if (/dinner|movie/i.test(lowerMessage)) durationMinutes = 90;
  else if (/workout|gym|run/i.test(lowerMessage)) durationMinutes = 60;
  else if (/quick\s*(chat|call)/i.test(lowerMessage)) durationMinutes = 15;
  else if (/workshop|training/i.test(lowerMessage)) durationMinutes = 120;

  // Extract title
  let title = message
    .replace(/^(add|create|schedule|set up|book|make)\s+/i, "")
    .replace(/^(a|an)\s+/i, "")
    .replace(
      /\b(at|for|on|from|to)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi,
      ""
    )
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, "")
    .replace(/\b(tomorrow|today|next\s+\w+day)\b/gi, "")
    .replace(
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  if (title.length < 3) title = "New event";
  title = title.charAt(0).toUpperCase() + title.slice(1);

  const startDate = new Date(eventDate);
  startDate.setHours(hour, minute, 0, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const timeStr = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endTimeStr = endDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const durationLabel =
    durationMinutes >= 60
      ? `${durationMinutes / 60}hr`
      : `${durationMinutes} min`;

  return {
    type: "create_event",
    message: `${dateStr} ${timeStr}–${endTimeStr} · ${durationLabel}`,
    proposal: {
      title,
      start: startDate.getTime(),
      end: endDate.getTime(),
    },
  };
}
