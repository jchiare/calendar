"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const aiTopics = [
  {
    title: "Family scheduling preferences",
    detail: "Quiet hours, buffers, and school pickup rules."
  },
  {
    title: "AI permissions",
    detail: "Default to safe edits, confirm deletions."
  },
  {
    title: "Summary cadence",
    detail: "Weekly digest on Sunday evening."
  }
];

const aiPrompts = [
  "Add 3pm meeting to take out trash",
  "Schedule dentist appointment at 2:30pm tomorrow",
  "Create team standup at 9am on Monday"
];

const proactiveSignals = [
  "Low-fridge inventory alerts",
  "Traffic delay warnings before appointments",
  "Travel deal opportunities during free windows"
];

const householdOnboardingSteps = [
  "Create household workspace and timezone",
  "Invite members and assign roles",
  "Connect personal/shared calendars",
  "Set AI permissions and notification rules",
  "Run first-week conflict and routine setup"
];

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AdminPage() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const householdContext = useQuery(api.events.getHouseholdContext);
  const stats = useQuery(
    api.events.getStats,
    householdContext ? { workspaceId: householdContext.workspaceId } : "skip"
  );
  const processMessage = useAction(api.ai.processMessage);
  const ensureOnboardingSeed = useMutation(api.events.ensureOnboardingSeed);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || inputValue.trim();
    if (!text || isLoading) return;

    // Add user message to chat
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInputValue("");
    setIsLoading(true);

    try {
      const result = await processMessage({ message: text });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.message }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    handleSend(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSeedOnboarding = async () => {
    setIsSeeding(true);
    setSeedNotice("");
    try {
      const result = await ensureOnboardingSeed({});
      setSeedNotice(
        result.seededEvents
          ? "Onboarding data seeded for this household."
          : "Onboarding household already existed. Reused current data."
      );
    } catch {
      setSeedNotice("Unable to seed onboarding data. Please try again.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <main className="container-page py-10">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Admin console
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Family workspace settings</h1>
        <p className="text-sm text-slate-600">
          Manage members, integrations, and conflict resolution for your household.
        </p>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Product vision
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            AI-first household planning and execution
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Build a shared household system that plans schedules, coordinates people, and proactively acts before issues happen.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {proactiveSignals.map((signal) => (
              <span
                key={signal}
                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Household onboarding</h2>
          <p className="mt-1 text-sm text-slate-600">
            Recommended setup flow for multi-person households.
          </p>
          <ol className="mt-4 space-y-2">
            {householdOnboardingSteps.map((step, index) => (
              <li key={step} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            {householdContext ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Active household
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {householdContext.workspaceName}
                </p>
                <p className="text-xs text-slate-600">
                  Acting as {householdContext.activeUserName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {householdContext.members.map((member) => (
                    <span
                      key={member.id}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                    >
                      {member.name} · {member.role}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                No household workspace yet. Seed onboarding data to bootstrap one.
              </p>
            )}
          </div>
          <button
            onClick={handleSeedOnboarding}
            disabled={isSeeding}
            className="mt-3 cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-default disabled:opacity-50"
          >
            {isSeeding ? "Seeding..." : "Seed onboarding data"}
          </button>
          {seedNotice && (
            <p className="mt-2 text-xs text-slate-600">{seedNotice}</p>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {stats ? (
          stats.map((stat) => (
            <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</p>
            </div>
          ))
        ) : (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="mt-3 h-9 w-12 rounded bg-slate-200" />
            </div>
          ))
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">AI guidance center</h2>
          <p className="text-sm text-slate-600">
            Teach the assistant how your household plans, communicates, and resolves conflicts.
          </p>
          <div className="space-y-3">
            {aiTopics.map((topic) => (
              <div key={topic.title} className="rounded-2xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-900">{topic.title}</p>
                <p className="text-xs text-slate-500">{topic.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="cursor-pointer rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">
              Update AI rules
            </button>
            <button className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">
              Export preferences
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-4 rounded-3xl border border-indigo-200 bg-indigo-50 p-6 text-indigo-900 shadow-sm">
          <h2 className="text-lg font-semibold">Talk to AI about the calendar</h2>
          <p className="text-sm text-indigo-700">
            Add events, ask for summaries, or get help planning your schedule.
          </p>
          <div className="space-y-2">
            {aiPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePromptClick(prompt)}
                disabled={isLoading}
                className="w-full cursor-pointer rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-left text-xs font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat messages */}
          {messages.length > 0 && (
            <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-indigo-200 bg-white p-4 max-h-80">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl p-3 text-xs ${
                    msg.role === "user"
                      ? "ml-8 bg-indigo-600 text-white"
                      : "mr-8 bg-slate-100 text-slate-700"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
              {isLoading && (
                <div className="mr-8 rounded-xl bg-slate-100 p-3 text-xs text-slate-500">
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          <div className="rounded-2xl border border-indigo-200 bg-white p-4">
            <label className="text-xs font-semibold text-indigo-800" htmlFor="ai-message">
              Message AI
            </label>
            <textarea
              id="ai-message"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="mt-2 w-full rounded-2xl border border-indigo-100 p-3 text-xs text-slate-700"
              rows={3}
              placeholder="Try: Add 3pm meeting to take out trash"
              disabled={isLoading}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !inputValue.trim()}
                className="cursor-pointer rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? "Sending..." : "Send to AI"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
