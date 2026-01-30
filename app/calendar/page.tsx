import Link from "next/link";

const days = [
  { label: "Mon", date: "Mar 10" },
  { label: "Tue", date: "Mar 11" },
  { label: "Wed", date: "Mar 12" },
  { label: "Thu", date: "Mar 13" },
  { label: "Fri", date: "Mar 14" },
  { label: "Sat", date: "Mar 15" },
  { label: "Sun", date: "Mar 16" }
];

const events = [
  {
    id: "evt-1",
    title: "School drop-off",
    time: "7:30 AM",
    day: "Mon",
    owner: "Alex"
  },
  {
    id: "evt-2",
    title: "Dentist appointment",
    time: "3:00 PM",
    day: "Wed",
    owner: "Jamie"
  },
  {
    id: "evt-3",
    title: "Family dinner",
    time: "6:00 PM",
    day: "Fri",
    owner: "Everyone"
  }
];

const timeSlots = ["7 AM", "9 AM", "11 AM", "1 PM", "3 PM", "5 PM", "7 PM"];

export default function CalendarPage() {
  return (
    <main className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Weekly view
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Family calendar</h1>
          <p className="text-sm text-slate-600">
            Shared availability synced with Google Calendar.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Today
          </button>
          <button className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            New event
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.8fr_0.5fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid grid-cols-7 gap-3 border-b border-slate-100 pb-4 text-center text-xs font-semibold text-slate-500">
            {days.map((day) => (
              <div key={day.label} className="space-y-1">
                <p className="text-slate-900">{day.label}</p>
                <p>{day.date}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-[100px_repeat(7,minmax(0,1fr))] gap-3">
            {timeSlots.map((time) => (
              <div key={time} className="contents">
                <div className="text-xs font-semibold text-slate-400">{time}</div>
                {days.map((day) => (
                  <div key={`${day.label}-${time}`} className="h-20 rounded-2xl border border-slate-100" />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                <p className="text-base font-semibold text-indigo-900">{event.title}</p>
                <p className="text-sm text-indigo-700">
                  {event.day} · {event.time}
                </p>
                <p className="text-sm text-indigo-600">Owner: {event.owner}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Family members</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {["Alex", "Jamie", "Taylor", "Morgan"].map((member) => (
                <li key={member} className="flex items-center justify-between">
                  <span>{member}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                    Available
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-indigo-100 bg-indigo-600 p-6 text-white">
            <h2 className="text-lg font-semibold">Next up</h2>
            <p className="mt-2 text-sm text-indigo-100">
              AI suggests adding a 15-minute buffer before “Dentist appointment”.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-full bg-white/20 px-3 py-2 text-xs font-semibold">
                Accept suggestion
              </button>
              <Link className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold" href="/admin">
                Review rules
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
