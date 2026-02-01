"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const stats = [
  { label: "Active family members", value: "4" },
  { label: "Connected calendars", value: "2" },
  { label: "Pending conflicts", value: "3" }
];

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

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AdminPage() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const processMessage = useMutation(api.ai.processMessage);

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

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
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
            <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-indigo-200 bg-white p-4">
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
