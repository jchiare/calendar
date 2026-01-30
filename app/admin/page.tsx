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
  "Suggest time blocks for homework and screen-free time.",
  "Summarize conflicts for next week and propose fixes.",
  "Draft an invite for the monthly family check-in."
];

export default function AdminPage() {
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
            <button className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">
              Update AI rules
            </button>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">
              Export preferences
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-indigo-200 bg-indigo-50 p-6 text-indigo-900 shadow-sm">
          <h2 className="text-lg font-semibold">Talk to AI about the calendar</h2>
          <p className="text-sm text-indigo-700">
            Ask for summaries, planning help, or adjustments to household routines.
          </p>
          <div className="space-y-3">
            {aiPrompts.map((prompt) => (
              <button
                key={prompt}
                className="w-full rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-left text-xs font-semibold text-indigo-800"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-white p-4">
            <label className="text-xs font-semibold text-indigo-800" htmlFor="ai-message">
              Message AI
            </label>
            <textarea
              id="ai-message"
              className="mt-2 w-full rounded-2xl border border-indigo-100 p-3 text-xs text-slate-700"
              rows={4}
              placeholder="Ask the assistant to adjust routines or summarize conflicts."
            />
            <div className="mt-3 flex justify-end">
              <button className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">
                Send to AI
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
