"use client";

import { useMemo, useState } from "react";

type IconName =
  | "home"
  | "calendar"
  | "clients"
  | "notes"
  | "sparkle"
  | "settings"
  | "search"
  | "plus"
  | "chevron"
  | "clock"
  | "video"
  | "check"
  | "dots"
  | "bell"
  | "arrow";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </>
    ),
    clients: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    notes: (
      <>
        <path d="M6 3h12a2 2 0 0 1 2 2v16l-4-3-4 3-4-3-4 3V5a2 2 0 0 1 2-2Z" />
        <path d="M8 8h8M8 12h6" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" />
        <path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
        <path d="m5 13 1 2.5L8.5 17 6 18l-1 3-1-3-2.5-1L4 15.5 5 13Z" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8c.4.25.72.6.9 1 .13.3.2.64.2 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    dots: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

const appointments = [
  {
    time: "9:00",
    period: "AM",
    name: "Mia Robinson",
    meta: "Speech therapy · 45 min",
    tone: "apricot",
    avatar: "MR",
    mode: "In person",
    done: false,
  },
  {
    time: "10:15",
    period: "AM",
    name: "Noah Williams",
    meta: "Speech therapy · 30 min",
    tone: "lavender",
    avatar: "NW",
    mode: "Telehealth",
    done: false,
  },
  {
    time: "11:30",
    period: "AM",
    name: "Leo Thompson",
    meta: "Speech therapy · 45 min",
    tone: "mint",
    avatar: "LT",
    mode: "In person",
    done: true,
  },
  {
    time: "1:00",
    period: "PM",
    name: "Sofia Garcia",
    meta: "Speech therapy · 45 min",
    tone: "rose",
    avatar: "SG",
    mode: "In person",
    done: false,
  },
  {
    time: "2:30",
    period: "PM",
    name: "Ethan Chen",
    meta: "Speech therapy · 30 min",
    tone: "sky",
    avatar: "EC",
    mode: "Telehealth",
    done: false,
  },
];

const days = [
  { d: "MON", n: 8, count: 5 },
  { d: "TUE", n: 9, count: 4 },
  { d: "WED", n: 10, count: 6, active: true },
  { d: "THU", n: 11, count: 3 },
  { d: "FRI", n: 12, count: 4 },
];

export default function Dashboard() {
  const [active, setActive] = useState("Overview");
  const [selectedDay, setSelectedDay] = useState(10);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const visibleAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        appointment.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">s</span>
          <span>sayso</span>
        </div>
        <div className="workspace">
          <div className="clinic-icon">BP</div>
          <div>
            <strong>Bright Path</strong>
            <small>Speech Therapy</small>
          </div>
          <Icon name="chevron" size={15} />
        </div>
        <nav>
          <p>WORKSPACE</p>
          {[
            { n: "Overview", i: "home" },
            { n: "Calendar", i: "calendar" },
            { n: "Clients", i: "clients" },
            { n: "Session notes", i: "notes" },
            { n: "AI assistant", i: "sparkle" },
          ].map((item) => (
            <button
              className={active === item.n ? "nav-item active" : "nav-item"}
              key={item.n}
              onClick={() => setActive(item.n)}
            >
              <Icon name={item.i as IconName} />
              <span>{item.n}</span>
              {item.n === "Session notes" && <b>3</b>}
            </button>
          ))}
          <p className="manage-label">MANAGE</p>
          <button className="nav-item" onClick={() => setActive("Settings")}>
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="help-card">
            <span>
              <Icon name="sparkle" size={15} />
            </span>
            <strong>Need a hand?</strong>
            <p>Visit the Sayso help center.</p>
            <button>
              Get help <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="profile">
            <div className="avatar dark">AJ</div>
            <div>
              <strong>Alex Johnson</strong>
              <small>Therapist</small>
            </div>
            <button>
              <Icon name="dots" />
            </button>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">s</span>sayso
          </div>
          <label className="search">
            <Icon name="search" />
            <input
              aria-label="Search clients"
              placeholder="Search clients…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notifications">
              <Icon name="bell" />
              <i />
            </button>
            <div className="today-chip">
              <span className="pulse" /> Wednesday, Sep 10
            </div>
          </div>
        </header>

        <div className="content">
          <section className="welcome">
            <div>
              <p className="eyebrow">WEDNESDAY, SEPTEMBER 10</p>
              <h1>Good morning, Alex.</h1>
              <p>Here&apos;s what&apos;s happening at Bright Path today.</p>
            </div>
            <button className="primary" onClick={() => setShowModal(true)}>
              <Icon name="plus" /> New appointment
            </button>
          </section>

          <section className="stats">
            <div className="stat">
              <span className="stat-icon peach">
                <Icon name="calendar" />
              </span>
              <div>
                <small>TODAY&apos;S SESSIONS</small>
                <strong>5</strong>
                <p>
                  <em>↑ 1</em> from last Wednesday
                </p>
              </div>
            </div>
            <div className="stat">
              <span className="stat-icon green">
                <Icon name="clients" />
              </span>
              <div>
                <small>ACTIVE CLIENTS</small>
                <strong>24</strong>
                <p>
                  <em>+3</em> this month
                </p>
              </div>
            </div>
            <div className="stat">
              <span className="stat-icon purple">
                <Icon name="notes" />
              </span>
              <div>
                <small>NOTES TO FINISH</small>
                <strong>3</strong>
                <p>From this week</p>
              </div>
            </div>
            <div className="stat">
              <span className="stat-icon blue">
                <Icon name="clock" />
              </span>
              <div>
                <small>HOURS THIS WEEK</small>
                <strong>18.5</strong>
                <p>of 25 scheduled</p>
              </div>
            </div>
          </section>

          <div className="dashboard-grid">
            <section className="panel schedule-panel">
              <div className="panel-head">
                <div>
                  <h2>Today&apos;s schedule</h2>
                  <p>5 sessions · 3h 15m total</p>
                </div>
                <button>
                  View calendar <Icon name="chevron" size={15} />
                </button>
              </div>
              <div className="appointment-list">
                {visibleAppointments.map((appointment, appointmentIndex) => (
                  <div
                    className={`appointment ${appointment.done ? "completed" : ""}`}
                    key={appointment.name}
                  >
                    <div className="time">
                      <strong>{appointment.time}</strong>
                      <small>{appointment.period}</small>
                    </div>
                    <div className="timeline">
                      <span
                        className={`line-dot ${appointmentIndex === 0 ? "now" : ""}`}
                      />
                    </div>
                    <div className={`avatar ${appointment.tone}`}>
                      {appointment.avatar}
                    </div>
                    <div className="appointment-info">
                      <strong>{appointment.name}</strong>
                      <p>{appointment.meta}</p>
                    </div>
                    <span className="mode">
                      <Icon
                        name={appointment.mode === "Telehealth" ? "video" : "home"}
                        size={14}
                      />
                      {appointment.mode}
                    </span>
                    {appointment.done ? (
                      <span className="done">
                        <Icon name="check" size={13} /> Complete
                      </span>
                    ) : (
                      <button
                        className="start"
                        onClick={() => setActive("Session notes")}
                      >
                        {appointmentIndex === 0 ? "Start session" : <Icon name="dots" />}
                      </button>
                    )}
                  </div>
                ))}
                {!visibleAppointments.length && (
                  <div className="empty">No clients match “{query}”.</div>
                )}
              </div>
            </section>

            <aside className="right-column">
              <section className="panel week-panel">
                <div className="panel-head">
                  <div>
                    <h2>This week</h2>
                    <p>September 8–12</p>
                  </div>
                  <button>
                    <Icon name="chevron" size={15} />
                  </button>
                </div>
                <div className="week-days">
                  {days.map((day) => (
                    <button
                      key={day.n}
                      onClick={() => setSelectedDay(day.n)}
                      className={selectedDay === day.n ? "selected" : ""}
                    >
                      <small>{day.d}</small>
                      <strong>{day.n}</strong>
                      <span>{day.count}</span>
                    </button>
                  ))}
                </div>
                <div className="week-total">
                  <span>
                    <b>22</b> sessions scheduled
                  </span>
                  <strong>16.5 hours</strong>
                </div>
              </section>
              <section className="panel tasks">
                <div className="panel-head">
                  <div>
                    <h2>To finish</h2>
                    <p>Keep your notes up to date</p>
                  </div>
                  <span className="task-count">3</span>
                </div>
                {[
                  {
                    a: "NW",
                    n: "Noah Williams",
                    d: "Yesterday · 10:15 AM",
                    t: "lavender",
                  },
                  { a: "SG", n: "Sofia Garcia", d: "Mon · 1:00 PM", t: "rose" },
                  {
                    a: "JM",
                    n: "Jackson Miller",
                    d: "Mon · 3:30 PM",
                    t: "sand",
                  },
                ].map((task) => (
                  <button className="task" key={task.n}>
                    <span className={`avatar ${task.t}`}>{task.a}</span>
                    <span>
                      <strong>{task.n}</strong>
                      <small>{task.d}</small>
                    </span>
                    <Icon name="chevron" size={16} />
                  </button>
                ))}
                <button className="all-notes">
                  View all session notes <Icon name="arrow" size={15} />
                </button>
              </section>
            </aside>
          </div>

          <section className="insight">
            <div className="insight-icon">
              <Icon name="sparkle" size={22} />
            </div>
            <div>
              <span>AI INSIGHT</span>
              <h3>Three clients may be ready to advance a goal.</h3>
              <p>
                Based on their last three sessions, Mia, Leo, and Ethan have consistently
                scored 5/5.
              </p>
            </div>
            <button>
              Review suggestions <Icon name="arrow" size={15} />
            </button>
          </section>
        </div>
      </main>
      {showModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}>
          <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              ×
            </button>
            <span className="stat-icon peach">
              <Icon name="calendar" />
            </span>
            <p className="eyebrow">NEW APPOINTMENT</p>
            <h2>Schedule a session</h2>
            <p>Choose a client and time to add them to your calendar.</p>
            <label>
              Client
              <select>
                <option>Mia Robinson</option>
                <option>Noah Williams</option>
                <option>Sofia Garcia</option>
              </select>
            </label>
            <div className="form-row">
              <label>
                Date
                <input type="date" defaultValue="2026-09-10" />
              </label>
              <label>
                Time
                <input type="time" defaultValue="09:00" />
              </label>
            </div>
            <label>
              Duration
              <select>
                <option>45 minutes</option>
                <option>30 minutes</option>
                <option>60 minutes</option>
              </select>
            </label>
            <button className="primary wide" onClick={() => setShowModal(false)}>
              Schedule appointment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
