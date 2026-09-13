import Link from "next/link";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { demoClients } from "@/lib/demo";

const slots = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM"];
export default function CalendarPage() {
  return (
    <AppShell
      title="Calendar"
      eyebrow="SEPTEMBER 8–12, 2026"
      action={<button className="primary">＋ New appointment</button>}
    >
      <div className="calendar-tools">
        <div>
          <button>‹</button>
          <button>Today</button>
          <button>›</button>
        </div>
        <div>
          <button className="selected">Week</button>
          <button>Month</button>
        </div>
      </div>
      <section className="calendar-card">
        <div className="cal-head">
          <span />
          <span>
            MON <b>8</b>
          </span>
          <span>
            TUE <b>9</b>
          </span>
          <span className="today">
            WED <b>10</b>
          </span>
          <span>
            THU <b>11</b>
          </span>
          <span>
            FRI <b>12</b>
          </span>
        </div>
        <div className="cal-body">
          <div className="times">
            {slots.map((timeLabel) => (
              <span key={timeLabel}>{timeLabel}</span>
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((day) => (
            <div className="cal-day" key={day}>
              {demoClients.slice(0, day === 2 ? 4 : 2).map((client, appointmentIndex) => (
                <Link
                  href={`/sessions/${client.id}`}
                  className={`cal-event ${client.tone}`}
                  style={{
                    top: `${25 + appointmentIndex * 92}px`,
                    height: appointmentIndex % 2 ? "52px" : "70px",
                  }}
                  key={client.id}
                >
                  <strong>
                    {appointmentIndex + 9}:{appointmentIndex ? "15" : "00"} ·{" "}
                    {client.name}
                  </strong>
                  <small>{appointmentIndex % 2 ? "30" : "45"} min</small>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>
      <div className="legend">
        <StatusBadge>Scheduled</StatusBadge>
        <StatusBadge tone="gray">Completed</StatusBadge>
        <StatusBadge tone="orange">Cancelled</StatusBadge>
      </div>
    </AppShell>
  );
}
