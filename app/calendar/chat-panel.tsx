"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { AIResponse, EventProposal } from "../../convex/ai";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal?: EventProposal;
  proposals?: EventProposal[];
  recurrenceId?: string;
  status?: "pending" | "confirmed" | "tweaking";
};

type GhostEvent = {
  title: string;
  start: number;
  end: number;
  location?: string;
};

const SUGGESTIONS = [
  "Coffee tomorrow at 10",
  "Workout Friday 7am",
  "Dentist next Monday 2pm",
];

const MIN_RECURRING_WEEKS = 1;
const MAX_RECURRING_WEEKS = 24;
const RECURRING_WEEK_OPTIONS = Array.from(
  { length: MAX_RECURRING_WEEKS },
  (_, i) => i + 1
);
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type RecurringSeriesMeta = {
  recurringDays: number[];
  weeks: number;
  anchorStart: number;
  durationMinutes: number;
};

function clampWeeks(value: number): number {
  return Math.min(MAX_RECURRING_WEEKS, Math.max(MIN_RECURRING_WEEKS, value));
}

function getRecurringSeriesMeta(proposals: EventProposal[]): RecurringSeriesMeta | null {
  if (proposals.length === 0) return null;

  const sorted = [...proposals].sort((a, b) => a.start - b.start);
  const recurringDays = Array.from(
    new Set(sorted.map((proposal) => new Date(proposal.start).getDay()))
  ).sort((a, b) => a - b);
  const daysPerWeek = Math.max(1, recurringDays.length);
  const weeks = Math.max(1, Math.ceil(sorted.length / daysPerWeek));
  const durationMinutes = Math.max(
    15,
    Math.round((sorted[0].end - sorted[0].start) / 60000)
  );

  return {
    recurringDays,
    weeks,
    anchorStart: sorted[0].start,
    durationMinutes,
  };
}

function buildRecurringProposals(
  baseProposal: EventProposal,
  meta: RecurringSeriesMeta,
  weeks: number
): EventProposal[] {
  const clampedWeeks = clampWeeks(weeks);
  const anchor = new Date(meta.anchorStart);
  const anchorDow = anchor.getDay();
  const proposals: EventProposal[] = [];

  for (let week = 0; week < clampedWeeks; week++) {
    for (const dayNum of meta.recurringDays) {
      let daysOffset = dayNum - anchorDow;
      if (daysOffset < 0) daysOffset += 7;
      daysOffset += week * 7;

      const start = new Date(anchor);
      start.setDate(anchor.getDate() + daysOffset);
      start.setHours(anchor.getHours(), anchor.getMinutes(), 0, 0);

      const end = new Date(start.getTime() + meta.durationMinutes * 60 * 1000);

      proposals.push({
        ...baseProposal,
        start: start.getTime(),
        end: end.getTime(),
      });
    }
  }

  proposals.sort((a, b) => a.start - b.start);
  return proposals;
}

function formatRecurringDays(dayIndices: number[]): string {
  const sorted = [...dayIndices].sort((a, b) => a - b);
  if (sorted.length === 0) return "selected days";
  if (sorted.length === 7) return "daily";
  if (
    sorted.length === 5 &&
    sorted[0] === 1 &&
    sorted[1] === 2 &&
    sorted[2] === 3 &&
    sorted[3] === 4 &&
    sorted[4] === 5
  ) {
    return "Mon–Fri";
  }
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) {
    return "weekends";
  }

  const isContiguous = sorted.every((day, index) =>
    index === 0 ? true : day === sorted[index - 1] + 1
  );
  if (isContiguous && sorted.length >= 3) {
    return `${WEEKDAY_LABELS[sorted[0]]}–${WEEKDAY_LABELS[sorted[sorted.length - 1]]}`;
  }

  return sorted.map((day) => WEEKDAY_LABELS[day]).join(", ");
}

function formatTimeRange(start: number, end: number): string {
  const startLabel = new Date(start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endLabel = new Date(end).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${startLabel}–${endLabel}`;
}

function formatWeeksLabel(weeks: number): string {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

function formatProposalTime(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
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
  const durationMs = end - start;
  const durationMin = Math.round(durationMs / 60000);
  const durationLabel =
    durationMin >= 60 ? `${(durationMin / 60).toFixed(durationMin % 60 === 0 ? 0 : 1)}hr` : `${durationMin} min`;

  return `${dateStr} ${timeStr}–${endTimeStr} · ${durationLabel}`;
}

function ConfirmationCard({
  message,
  onConfirm,
  onBatchConfirm,
  onTweak,
  onCancelTweak,
  onSaveTweak,
}: {
  message: ChatMessage;
  onConfirm: (proposal: EventProposal) => void;
  onBatchConfirm: (
    messageId: string,
    proposals: EventProposal[],
    recurrenceId?: string
  ) => void;
  onTweak: (messageId: string) => void;
  onCancelTweak: (messageId: string) => void;
  onSaveTweak: (messageId: string, proposal: EventProposal) => void;
}) {
  const proposal = message.proposal!;
  const isBatch = message.proposals && message.proposals.length > 1;
  const [tweakData, setTweakData] = useState(() => {
    const start = new Date(proposal.start);
    const end = new Date(proposal.end);
    const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
    return {
      title: proposal.title,
      date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
      time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      duration: String(durationMin),
      location: proposal.location || "",
      notes: proposal.description || "",
    };
  });

  const recurringMeta = useMemo(
    () => (isBatch ? getRecurringSeriesMeta(message.proposals ?? []) : null),
    [isBatch, message.proposals]
  );

  const [recurringWeeks, setRecurringWeeks] = useState(() =>
    clampWeeks(recurringMeta?.weeks ?? MIN_RECURRING_WEEKS)
  );

  useEffect(() => {
    if (!recurringMeta) return;
    setRecurringWeeks(clampWeeks(recurringMeta.weeks));
  }, [message.id, recurringMeta]);

  const proposalsToConfirm = useMemo(() => {
    if (!isBatch || !message.proposals || !recurringMeta) {
      return message.proposals ?? [];
    }
    return buildRecurringProposals(proposal, recurringMeta, recurringWeeks);
  }, [isBatch, message.proposals, proposal, recurringMeta, recurringWeeks]);

  const recurringDayLabel = recurringMeta
    ? formatRecurringDays(recurringMeta.recurringDays)
    : "selected days";
  const recurringTimeLabel = formatTimeRange(proposal.start, proposal.end);
  const recurringEventCount = proposalsToConfirm.length;

  if (message.status === "confirmed") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
        <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>
          <span className="font-medium">{proposal.title}</span>
          {isBatch ? ` (${message.proposals!.length} events)` : ""} added
        </span>
      </div>
    );
  }

  if (message.status === "tweaking") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-3 text-sm font-semibold text-slate-900">
          {proposal.title}
        </p>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-slate-500">Title</label>
            <input
              type="text"
              value={tweakData.title}
              onChange={(e) =>
                setTweakData({ ...tweakData, title: e.target.value })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500">Date</label>
              <input
                type="date"
                value={tweakData.date}
                onChange={(e) =>
                  setTweakData({ ...tweakData, date: e.target.value })
                }
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Time</label>
              <input
                type="time"
                value={tweakData.time}
                onChange={(e) =>
                  setTweakData({ ...tweakData, time: e.target.value })
                }
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500">
                Duration (min)
              </label>
              <select
                value={tweakData.duration}
                onChange={(e) =>
                  setTweakData({ ...tweakData, duration: e.target.value })
                }
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hr</option>
                <option value="90">1.5 hr</option>
                <option value="120">2 hr</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Location</label>
              <input
                type="text"
                value={tweakData.location}
                onChange={(e) =>
                  setTweakData({ ...tweakData, location: e.target.value })
                }
                placeholder="Optional"
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500">Notes</label>
            <input
              type="text"
              value={tweakData.notes}
              onChange={(e) =>
                setTweakData({ ...tweakData, notes: e.target.value })
              }
              placeholder="Optional"
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => onCancelTweak(message.id)}
            className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const [year, month, day] = tweakData.date
                .split("-")
                .map(Number);
              const [hours, minutes] = tweakData.time.split(":").map(Number);
              const startDate = new Date(year, month - 1, day, hours, minutes);
              const endDate = new Date(
                startDate.getTime() + parseInt(tweakData.duration) * 60 * 1000
              );
              onSaveTweak(message.id, {
                title: tweakData.title,
                start: startDate.getTime(),
                end: endDate.getTime(),
                location: tweakData.location || undefined,
                description: tweakData.notes || undefined,
              });
            }}
            className="cursor-pointer rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  // Default: pending confirmation
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
      <p className="text-sm font-semibold text-slate-900">
        {isBatch ? `Adding ${proposal.title}` : proposal.title}
      </p>
      <div className="mt-1.5 flex flex-col gap-1 text-xs text-slate-600">
        {isBatch ? (
          <>
            <div className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Every {recurringDayLabel}
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {recurringTimeLabel}
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4m16 0a8 8 0 11-16 0 8 8 0 0116 0z"
                />
              </svg>
              {recurringEventCount} events across {formatWeeksLabel(recurringWeeks)}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <svg
              className="h-3.5 w-3.5 flex-shrink-0 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {formatProposalTime(proposal.start, proposal.end)}
          </div>
        )}
        {proposal.location && (
          <div className="flex items-center gap-1.5">
            <svg
              className="h-3.5 w-3.5 flex-shrink-0 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {proposal.location}
          </div>
        )}
        {proposal.attendees && proposal.attendees.length > 0 && (
          <div className="flex items-center gap-1.5">
            <svg
              className="h-3.5 w-3.5 flex-shrink-0 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {proposal.attendees.join(", ")}
          </div>
        )}
      </div>

      {isBatch && recurringMeta && (
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-indigo-200/70 bg-white/60 px-2.5 py-2">
          <p className="text-xs font-medium text-slate-700">Weeks</p>
          <select
            value={recurringWeeks}
            onChange={(e) => setRecurringWeeks(clampWeeks(Number(e.target.value)))}
            className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-indigo-400 focus:outline-none"
          >
            {RECURRING_WEEK_OPTIONS.map((week) => (
              <option key={week} value={week}>
                {formatWeeksLabel(week)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        {!isBatch && (
          <button
            onClick={() => onTweak(message.id)}
            className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Modify
          </button>
        )}
        <button
          onClick={() =>
            isBatch
              ? onBatchConfirm(message.id, proposalsToConfirm, message.recurrenceId)
              : onConfirm(proposal)
          }
          className={`cursor-pointer rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 ${isBatch ? "ml-auto" : ""}`}
        >
          {isBatch ? `Add ${recurringEventCount} events` : "Add"}
        </button>
      </div>
    </div>
  );
}

type HouseholdMember = {
  _id: Id<"users">;
  name: string;
  color: string;
  avatarEmoji?: string;
  role: string;
};

export default function ChatPanel({
  onGhostEventChange,
  activeMemberId,
  members,
}: {
  onGhostEventChange: (ghost: GhostEvent | null) => void;
  activeMemberId?: Id<"users"> | null;
  members?: HouseholdMember[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const processMessage = useAction(api.ai.processMessage);
  const createEvent = useMutation(api.events.createEvent);
  const batchCreateEvents = useMutation(api.events.batchCreateEvents);

  // Auto-scroll to bottom when messages/typing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Grow/shrink the input as the user types.
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${nextHeight}px`;
  }, [inputValue]);

  // Build conversation history for multi-turn context
  const getConversationHistory = useCallback(() => {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = text || inputValue.trim();
      if (!messageText || isLoading) return;

      setInputValue("");

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: messageText,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const history = getConversationHistory();
        // Pass household members to AI so it can assign events
        const householdMembers = members?.map((m) => ({
          id: m._id as string,
          name: m.name,
        }));
        // Current user defaults to first member (no auth yet)
        const currentUserName = activeMemberId
          ? members?.find((m) => m._id === activeMemberId)?.name
          : members?.[0]?.name;

        const response: AIResponse = await processMessage({
          message: messageText,
          conversationHistory: history,
          timezoneOffset: new Date().getTimezoneOffset(),
          householdMembers,
          currentUserName,
        });

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.message,
          proposal: response.proposal,
          proposals: response.proposals,
          recurrenceId: response.recurrenceId,
          status: response.type === "create_event" || response.type === "create_events" ? "pending" : undefined,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Set ghost event if we got a proposal
        if (response.proposal) {
          onGhostEventChange({
            title: response.proposal.title,
            start: response.proposal.start,
            end: response.proposal.end,
            location: response.proposal.location,
          });
        } else if (response.proposals && response.proposals.length > 0) {
          const preview = response.proposals[0];
          onGhostEventChange({
            title: preview.title,
            start: preview.start,
            end: preview.end,
            location: preview.location,
          });
        } else {
          onGhostEventChange(null);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Something went wrong. Please try again.",
          },
        ]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [inputValue, isLoading, processMessage, getConversationHistory, onGhostEventChange, activeMemberId, members]
  );

  const handleConfirm = useCallback(
    async (proposal: EventProposal) => {
      try {
        // Use AI-assigned memberIds, falling back to active member
        const memberIds = proposal.memberIds?.length
          ? (proposal.memberIds as Id<"users">[])
          : activeMemberId
            ? [activeMemberId]
            : members?.[0]?._id
              ? [members[0]._id]
              : undefined;
        await createEvent({
          title: proposal.title,
          start: proposal.start,
          end: proposal.end,
          location: proposal.location,
          description: proposal.description,
          createdBy: activeMemberId ?? members?.[0]?._id ?? undefined,
          memberIds,
        });

        // Update the message status to confirmed
        setMessages((prev) =>
          prev.map((m) =>
            m.proposal === proposal ? { ...m, status: "confirmed" as const } : m
          )
        );

        // Clear ghost event
        onGhostEventChange(null);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Failed to save the event. Please try again.",
          },
        ]);
      }
    },
    [createEvent, onGhostEventChange, activeMemberId, members]
  );

  const handleBatchConfirm = useCallback(
    async (
      messageId: string,
      proposals: EventProposal[],
      recurrenceId?: string
    ) => {
      try {
        // Use AI-assigned memberIds from the first proposal (all proposals in a batch share the same assignment)
        const firstProposal = proposals[0];
        const memberIds = firstProposal?.memberIds?.length
          ? (firstProposal.memberIds as Id<"users">[])
          : activeMemberId
            ? [activeMemberId]
            : members?.[0]?._id
              ? [members[0]._id]
              : undefined;
        await batchCreateEvents({
          events: proposals.map((p) => ({
            title: p.title,
            start: p.start,
            end: p.end,
            location: p.location,
            description: p.description,
          })),
          recurrenceId,
          createdBy: activeMemberId ?? members?.[0]?._id ?? undefined,
          memberIds,
        });

        // Update the message status to confirmed
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  proposals,
                  status: "confirmed" as const,
                }
              : m
          )
        );

        onGhostEventChange(null);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Failed to save the events. Please try again.",
          },
        ]);
      }
    },
    [batchCreateEvents, onGhostEventChange, activeMemberId, members]
  );

  const handleTweak = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: "tweaking" as const } : m
      )
    );
  }, []);

  const handleCancelTweak = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: "pending" as const } : m
      )
    );
  }, []);

  const handleSaveTweak = useCallback(
    async (messageId: string, updatedProposal: EventProposal) => {
      try {
        const memberIds = updatedProposal.memberIds?.length
          ? (updatedProposal.memberIds as Id<"users">[])
          : activeMemberId
            ? [activeMemberId]
            : members?.[0]?._id
              ? [members[0]._id]
              : undefined;
        await createEvent({
          title: updatedProposal.title,
          start: updatedProposal.start,
          end: updatedProposal.end,
          location: updatedProposal.location,
          description: updatedProposal.description,
          createdBy: activeMemberId ?? members?.[0]?._id ?? undefined,
          memberIds,
        });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, proposal: updatedProposal, status: "confirmed" as const }
              : m
          )
        );

        onGhostEventChange(null);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Failed to save the event. Please try again.",
          },
        ]);
      }
    },
    [createEvent, onGhostEventChange, activeMemberId, members]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleResetChat = useCallback(() => {
    setMessages([]);
    setInputValue("");
    onGhostEventChange(null);
    inputRef.current?.focus();
  }, [onGhostEventChange]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
      {messages.length > 0 && (
        <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5 sm:px-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Conversation
          </p>
          <button
            onClick={handleResetChat}
            disabled={isLoading}
            className="cursor-pointer rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
          >
            New chat
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 sm:px-4 sm:py-4">
        <div className="space-y-3 pb-2">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-3 py-2 text-[13px] text-white sm:text-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="max-w-[95%]">
                  {msg.proposal ? (
                    <ConfirmationCard
                      message={msg}
                      onConfirm={handleConfirm}
                      onBatchConfirm={handleBatchConfirm}
                      onTweak={handleTweak}
                      onCancelTweak={handleCancelTweak}
                      onSaveTweak={handleSaveTweak}
                    />
                  ) : (
                    <div className="rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-[13px] text-slate-700 sm:text-sm">
                      {msg.content}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="max-w-[85%]">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions (show when no messages) */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3.5 py-2.5 sm:px-4">
          <p className="w-full text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick starts</p>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSend(suggestion)}
              className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-100 px-3 py-3 sm:py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messages.length === 0 ? "Schedule anything..." : "Reply..."}
            rows={1}
            className="max-h-40 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none sm:text-sm"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            className="cursor-pointer flex-shrink-0 rounded-xl bg-indigo-600 p-2.5 text-white transition-colors hover:bg-indigo-700 disabled:cursor-default disabled:opacity-40"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19V5m0 0l-7 7m7-7l7 7"
              />
            </svg>
          </button>
        </div>
        {activeMemberId && members && (
          <p className="mt-1.5 text-[11px] text-slate-400">
            Creating as <span className="font-medium text-slate-600">{members.find((m) => m._id === activeMemberId)?.name}</span>
          </p>
        )}
        {!activeMemberId && (
          <p className="mt-1.5 text-[11px] text-slate-400">Enter to send, Shift+Enter for a new line.</p>
        )}
      </div>
    </div>
  );
}
