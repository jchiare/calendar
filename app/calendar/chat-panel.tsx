"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { AIResponse, EventProposal } from "../../convex/ai";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal?: EventProposal;
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
  onTweak,
  onCancelTweak,
  onSaveTweak,
}: {
  message: ChatMessage;
  onConfirm: (proposal: EventProposal) => void;
  onTweak: (messageId: string) => void;
  onCancelTweak: (messageId: string) => void;
  onSaveTweak: (messageId: string, proposal: EventProposal) => void;
}) {
  const proposal = message.proposal!;
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

  if (message.status === "confirmed") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
        <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>
          <span className="font-medium">{proposal.title}</span> added
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
      <p className="text-sm font-semibold text-slate-900">{proposal.title}</p>
      <div className="mt-1.5 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <svg className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatProposalTime(proposal.start, proposal.end)}
        </div>
        {proposal.location && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <svg className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {proposal.location}
          </div>
        )}
        {proposal.attendees && proposal.attendees.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <svg className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {proposal.attendees.join(", ")}
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <button
          onClick={() => onTweak(message.id)}
          className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Modify
        </button>
        <button
          onClick={() => onConfirm(proposal)}
          className="cursor-pointer rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function ChatPanel({
  onGhostEventChange,
}: {
  onGhostEventChange: (ghost: GhostEvent | null) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const processMessage = useAction(api.ai.processMessage);
  const createEvent = useMutation(api.events.createEvent);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        const response: AIResponse = await processMessage({
          message: messageText,
          conversationHistory: history,
          timezoneOffset: new Date().getTimezoneOffset(),
        });

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.message,
          proposal: response.proposal,
          status: response.type === "create_event" ? "pending" : undefined,
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
    [inputValue, isLoading, processMessage, getConversationHistory, onGhostEventChange]
  );

  const handleConfirm = useCallback(
    async (proposal: EventProposal) => {
      try {
        await createEvent({
          title: proposal.title,
          start: proposal.start,
          end: proposal.end,
          location: proposal.location,
          description: proposal.description,
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
    [createEvent, onGhostEventChange]
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
        await createEvent({
          title: updatedProposal.title,
          start: updatedProposal.start,
          end: updatedProposal.end,
          location: updatedProposal.location,
          description: updatedProposal.description,
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
    [createEvent, onGhostEventChange]
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

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100">
          <svg
            className="h-3.5 w-3.5 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-900">
          AI Assistant
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
              <svg
                className="h-5 w-5 text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">
              Type to create an event
            </p>
            <p className="mt-1 text-xs text-slate-400">
              e.g., &ldquo;coffee with George tomorrow 3&rdquo;
            </p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-3 py-2 text-sm text-white">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="max-w-[95%]">
                  {msg.proposal ? (
                    <ConfirmationCard
                      message={msg}
                      onConfirm={handleConfirm}
                      onTweak={handleTweak}
                      onCancelTweak={handleCancelTweak}
                      onSaveTweak={handleSaveTweak}
                    />
                  ) : (
                    <div className="rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
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
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSend(suggestion)}
              className="cursor-pointer rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-100 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type an event..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            className="cursor-pointer flex-shrink-0 rounded-xl bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-default disabled:opacity-40"
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
      </div>
    </div>
  );
}
