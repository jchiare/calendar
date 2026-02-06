"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

type EventData = {
  _id: string;
  title: string;
  description?: string;
  start: number;
  end: number;
  location?: string;
};

const integrations = [
  "Google Calendar",
  "Gmail",
  "Google Meet",
  "Tasks"
];

const aiFeatures = [
  "Schedule family events with one message.",
  "Summarize your week and highlight conflicts.",
  "Auto-apply preferences like quiet hours and buffers."
];

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

export default function HomePage() {
  const hasConvexUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const welcome = useQuery(api.notes.getWelcome);
  const todayEvents = useQuery(api.events.getTodayEvents) as EventData[] | undefined;

  const welcomeMessage = hasConvexUrl
    ? welcome?.message ?? "Connecting to Convex..."
    : "Set NEXT_PUBLIC_CONVEX_URL to fetch live data.";

  const isLoading = todayEvents === undefined;
  const hasEvents = todayEvents && todayEvents.length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <section className="container-page py-14">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Conflict detected
                </p>
                <h2 className="text-xl font-semibold">
                  This event was updated in Google Calendar while you were editing.
                </h2>
                <p className="text-sm text-amber-700">
                  Choose how to resolve the conflict. You can set a default behavior later.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm">
                  Keep local
                </button>
                <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm">
                  Keep remote
                </button>
                <button className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                  Merge changes
                </button>
              </div>
            </div>
          </div>
          <header className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Family-first calendar
            </p>
            <h1 className="text-4xl font-semibold text-slate-900 md:text-5xl">
              Plan every moment with a shared family calendar and AI assistant.
            </h1>
            <p className="max-w-2xl text-lg text-slate-600">
              Built on Next.js, Tailwind, and Convex to sync with Google Calendar while keeping
              schedules aligned, conflicts resolved, and everyone informed.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                className="rounded-full bg-indigo-600 px-6 py-3 text-white transition hover:bg-indigo-700"
                href="/calendar"
              >
                Open calendar
              </Link>
              <Link
                className="rounded-full border border-indigo-200 px-6 py-3 text-indigo-700 transition hover:bg-indigo-100"
                href="/admin"
              >
                Admin console
              </Link>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl bg-white p-8 shadow-lg shadow-indigo-100">
              <h2 className="text-xl font-semibold text-slate-900">Today at a glance</h2>
              <div className="mt-6 space-y-4">
                {isLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    Loading today&apos;s events...
                  </div>
                ) : hasEvents ? (
                  todayEvents.map((event) => (
                    <div
                      key={event._id}
                      className="flex items-start gap-4 rounded-2xl border border-slate-100 p-4"
                    >
                      <div className="min-w-[80px] rounded-full bg-indigo-50 px-3 py-2 text-center text-sm font-semibold text-indigo-700">
                        {formatTime(event.start)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{event.title}</p>
                        <p className="text-sm text-slate-600">
                          {event.description || event.location || "No details"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                    <p className="text-sm text-slate-500">No events scheduled for today.</p>
                    <Link
                      href="/calendar"
                      className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Add an event
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Convex connection</h3>
                <p className="mt-2 text-sm text-slate-600">{welcomeMessage}</p>
                {hasConvexUrl ? (
                  <p className="mt-2 text-xs text-emerald-600 font-medium">
                    Connected and ready
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Configure <span className="font-semibold">NEXT_PUBLIC_CONVEX_URL</span> to connect.
                  </p>
                )}
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-lg shadow-indigo-100">
                <h3 className="text-lg font-semibold text-slate-900">AI chat highlights</h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  {aiFeatures.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-indigo-100 bg-indigo-600 p-6 text-white">
                <h3 className="text-lg font-semibold">Google-first integrations</h3>
                <p className="mt-2 text-sm text-indigo-100">
                  Focus on Google Calendar and related services for the cleanest sync and fastest setup.
                  Apple Calendar (CalDAV) is planned for a later phase.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {integrations.map((integration) => (
                    <span key={integration} className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                      {integration}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
