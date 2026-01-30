"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// Generic ID type since we don't have generated dataModel
type Id<T extends string> = string & { __tableName: T };

type EventData = {
  _id: Id<"events">;
  title: string;
  description?: string;
  start: number;
  end: number;
  location?: string;
};

type EventFormData = {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
};

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 19;
const EXTENDED_START_HOUR = 0;
const EXTENDED_END_HOUR = 24;

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function formatTimeSlot(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function parseTimeToHours(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours + minutes / 60;
}

function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  selectedDate
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventFormData) => void;
  onDelete?: () => void;
  initialData?: EventData;
  selectedDate?: Date;
}) {
  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    location: ""
  });

  useEffect(() => {
    if (initialData) {
      const start = new Date(initialData.start);
      const end = new Date(initialData.end);
      setFormData({
        title: initialData.title,
        description: initialData.description || "",
        date: start.toISOString().split("T")[0],
        startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
        endTime: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
        location: initialData.location || ""
      });
    } else if (selectedDate) {
      setFormData({
        title: "",
        description: "",
        date: selectedDate.toISOString().split("T")[0],
        startTime: "09:00",
        endTime: "10:00",
        location: ""
      });
    }
  }, [initialData, selectedDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">
          {initialData ? "Edit Event" : "New Event"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Event title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Date
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Start Time
              </label>
              <input
                type="time"
                required
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                End Time
              </label>
              <input
                type="time"
                required
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Location (optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Description (optional)"
            />
          </div>
          <div className="flex justify-between gap-3 pt-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {initialData ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    getWeekStart(new Date())
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const seededRef = useRef(false);

  const events = useQuery(api.events.getWeekEvents, {
    weekStart: currentWeekStart.getTime()
  });
  const seedDemo = useMutation(api.events.seedDemo);
  const createEvent = useMutation(api.events.createEvent);
  const updateEvent = useMutation(api.events.updateEvent);
  const deleteEvent = useMutation(api.events.deleteEvent);

  useEffect(() => {
    if (events && events.length === 0 && !seededRef.current) {
      seededRef.current = true;
      void seedDemo();
    }
  }, [events, seedDemo]);

  const days = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + index);
      const parts = formatter.formatToParts(date);
      const weekday = parts.find((p) => p.type === "weekday")?.value || "";
      const month = parts.find((p) => p.type === "month")?.value || "";
      const day = parts.find((p) => p.type === "day")?.value || "";

      return {
        label: weekday,
        date: `${month} ${day}`,
        fullDate: new Date(date),
        dayIndex: index
      };
    });
  }, [currentWeekStart]);

  // Calculate time range based on events
  const { startHour, endHour, timeSlots } = useMemo(() => {
    let minHour = DEFAULT_START_HOUR;
    let maxHour = DEFAULT_END_HOUR;

    if (events && events.length > 0) {
      for (const event of events) {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const eventStartHour = startDate.getHours();
        const eventEndHour =
          endDate.getHours() + (endDate.getMinutes() > 0 ? 1 : 0);

        if (eventStartHour < DEFAULT_START_HOUR) {
          minHour = EXTENDED_START_HOUR;
        }
        if (eventEndHour > DEFAULT_END_HOUR) {
          maxHour = EXTENDED_END_HOUR;
        }
      }
    }

    const slots: number[] = [];
    for (let h = minHour; h < maxHour; h++) {
      slots.push(h);
    }

    return { startHour: minHour, endHour: maxHour, timeSlots: slots };
  }, [events]);

  // Position events in the grid
  const eventPositions = useMemo(() => {
    if (!events) return [];

    return events.map((event) => {
      const startDate = new Date(event.start);
      const endDate = new Date(event.end);

      const dayOfWeek = startDate.getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const eventStartHour =
        startDate.getHours() + startDate.getMinutes() / 60;
      const eventEndHour = endDate.getHours() + endDate.getMinutes() / 60;

      const top = ((eventStartHour - startHour) / (endHour - startHour)) * 100;
      const height =
        ((eventEndHour - eventStartHour) / (endHour - startHour)) * 100;

      return {
        ...event,
        dayIndex,
        top: Math.max(0, top),
        height: Math.min(100 - Math.max(0, top), height),
        startTime: formatTime(startDate),
        endTime: formatTime(endDate)
      };
    });
  }, [events, startHour, endHour]);

  const navigateWeek = useCallback((direction: number) => {
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + direction * 7);
      return newDate;
    });
  }, []);

  const goToToday = useCallback(() => {
    setCurrentWeekStart(getWeekStart(new Date()));
  }, []);

  const handleSaveEvent = useCallback(
    async (formData: EventFormData) => {
      const [year, month, day] = formData.date.split("-").map(Number);
      const [startHours, startMinutes] = formData.startTime
        .split(":")
        .map(Number);
      const [endHours, endMinutes] = formData.endTime.split(":").map(Number);

      const startDate = new Date(year, month - 1, day, startHours, startMinutes);
      const endDate = new Date(year, month - 1, day, endHours, endMinutes);

      if (editingEvent) {
        await updateEvent({
          id: editingEvent._id,
          title: formData.title,
          description: formData.description || undefined,
          start: startDate.getTime(),
          end: endDate.getTime(),
          location: formData.location || undefined
        });
      } else {
        await createEvent({
          title: formData.title,
          description: formData.description || undefined,
          start: startDate.getTime(),
          end: endDate.getTime(),
          location: formData.location || undefined
        });
      }

      setModalOpen(false);
      setEditingEvent(null);
      setSelectedDate(undefined);
    },
    [editingEvent, createEvent, updateEvent]
  );

  const handleDeleteEvent = useCallback(async () => {
    if (editingEvent) {
      await deleteEvent({ id: editingEvent._id });
      setModalOpen(false);
      setEditingEvent(null);
    }
  }, [editingEvent, deleteEvent]);

  const openNewEventModal = useCallback((date?: Date) => {
    setEditingEvent(null);
    setSelectedDate(date);
    setModalOpen(true);
  }, []);

  const openEditEventModal = useCallback((event: EventData) => {
    setEditingEvent(event);
    setSelectedDate(undefined);
    setModalOpen(true);
  }, []);

  const isCurrentWeek = useMemo(() => {
    const today = getWeekStart(new Date());
    return currentWeekStart.getTime() === today.getTime();
  }, [currentWeekStart]);

  const weekLabel = useMemo(() => {
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const startMonth = currentWeekStart.toLocaleDateString("en-US", {
      month: "short"
    });
    const endMonth = endOfWeek.toLocaleDateString("en-US", { month: "short" });
    const startDay = currentWeekStart.getDate();
    const endDay = endOfWeek.getDate();
    const year = currentWeekStart.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }, [currentWeekStart]);

  return (
    <main className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Weekly view
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Family calendar
          </h1>
          <p className="text-sm text-slate-600">
            Shared availability synced with Google Calendar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek(-1)}
              className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Previous week"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span className="min-w-[180px] text-center text-sm font-medium text-slate-700">
              {weekLabel}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Next week"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <button
            onClick={goToToday}
            disabled={isCurrentWeek}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Today
          </button>
          <button
            onClick={() => openNewEventModal()}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            New event
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.8fr_0.5fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-2 border-b border-slate-100 pb-4">
            <div />
            {days.map((day) => {
              const isToday =
                day.fullDate.toDateString() === new Date().toDateString();
              return (
                <div
                  key={day.label}
                  className="space-y-1 text-center text-xs font-semibold"
                >
                  <p
                    className={
                      isToday ? "text-indigo-600" : "text-slate-900"
                    }
                  >
                    {day.label}
                  </p>
                  <p
                    className={`${isToday ? "rounded-full bg-indigo-600 text-white" : "text-slate-500"} mx-auto w-fit px-2 py-1`}
                  >
                    {day.date}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative mt-4">
            <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-2">
              {timeSlots.map((hour) => (
                <div key={hour} className="contents">
                  <div className="flex h-16 items-start justify-end pr-3 text-xs font-medium text-slate-400">
                    {formatTimeSlot(hour)}
                  </div>
                  {days.map((day) => (
                    <div
                      key={`${day.label}-${hour}`}
                      onClick={() => openNewEventModal(day.fullDate)}
                      className="h-16 cursor-pointer border-t border-slate-100 hover:bg-indigo-50/50"
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Event overlays */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-2">
              <div />
              {days.map((day, dayIdx) => (
                <div key={day.label} className="relative">
                  {eventPositions
                    .filter((e) => e.dayIndex === dayIdx)
                    .map((event) => (
                      <div
                        key={event._id}
                        onClick={() => openEditEventModal(event)}
                        className="pointer-events-auto absolute left-1 right-1 cursor-pointer overflow-hidden rounded-lg border border-indigo-200 bg-indigo-100 p-2 shadow-sm transition hover:bg-indigo-200"
                        style={{
                          top: `${event.top}%`,
                          height: `${Math.max(event.height, 8)}%`
                        }}
                      >
                        <p className="truncate text-xs font-semibold text-indigo-900">
                          {event.title}
                        </p>
                        {event.height > 12 && (
                          <p className="truncate text-xs text-indigo-700">
                            {event.startTime}
                          </p>
                        )}
                        {event.height > 20 && event.location && (
                          <p className="truncate text-xs text-indigo-600">
                            {event.location}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          {/* Loading state */}
          {events === undefined && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Loading events from Convex...
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Family members
            </h2>
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
              {events && events.length > 0
                ? `You have ${events.length} event${events.length > 1 ? "s" : ""} this week.`
                : "No events scheduled this week."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => openNewEventModal()}
                className="rounded-full bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30"
              >
                Add event
              </button>
              <Link
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
                href="/admin"
              >
                Review rules
              </Link>
            </div>
          </div>
        </aside>
      </div>

      <EventModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEvent(null);
          setSelectedDate(undefined);
        }}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        initialData={editingEvent || undefined}
        selectedDate={selectedDate}
      />
    </main>
  );
}
