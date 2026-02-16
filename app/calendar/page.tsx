"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import ChatPanel from "./chat-panel";

type EventData = Doc<"events">;

type EventFormData = {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
};

type DragInfo = {
  dayIndex: number;
  time: number; // time in hours (e.g., 9.25 for 9:15 AM)
};

type DragMode = 'create' | 'move' | 'resize-top' | 'resize-bottom';

type EventDragInfo = {
  event: EventData;
  originalStart: number;
  originalEnd: number;
  dayIndex: number;
};

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 19;
const EXTENDED_START_HOUR = 0;
const EXTENDED_END_HOUR = 24;
const TIME_INCREMENT_MINUTES = 15; // 15-minute buckets
const DRAG_THRESHOLD_PX = 5; // Minimum pixels to move before starting drag

// NOTE: Touch/mobile support is not yet optimized. This feature currently
// only supports mouse interactions. Touch events for tablets/phones would
// require additional implementation (onTouchStart, onTouchMove, onTouchEnd).

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
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

function snapToTimeIncrement(hours: number): number {
  // Snap to nearest 15-minute increment
  const totalMinutes = hours * 60;
  const snappedMinutes = Math.round(totalMinutes / TIME_INCREMENT_MINUTES) * TIME_INCREMENT_MINUTES;
  return snappedMinutes / 60;
}

function hoursToTimeString(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Lightweight popover for confirming event deletion.
// Used both from the hover × button on events AND from the edit modal's trash icon.
function DeletePopover({
  event,
  position,
  onDeleteSingle,
  onDeleteFuture,
  onClose,
}: {
  event: EventData;
  position: { x: number; y: number };
  onDeleteSingle: () => Promise<void>;
  onDeleteFuture?: () => Promise<void>;
  onClose: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isRecurring = !!event.recurrence;

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Close on Escape
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Clamp popover to viewport
  const [adjustedPos, setAdjustedPos] = useState(position);
  useEffect(() => {
    if (!popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    let { x, y } = position;
    if (x + rect.width > window.innerWidth - 16) x = window.innerWidth - rect.width - 16;
    if (y + rect.height > window.innerHeight - 16) y = y - rect.height - 8;
    if (x < 16) x = 16;
    if (y < 16) y = 16;
    setAdjustedPos({ x, y });
  }, [position]);

  const handleSingle = async () => {
    setIsDeleting(true);
    try { await onDeleteSingle(); } finally { setIsDeleting(false); }
    onClose();
  };
  const handleFuture = async () => {
    if (!onDeleteFuture) return;
    setIsDeleting(true);
    try { await onDeleteFuture(); } finally { setIsDeleting(false); }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        ref={popoverRef}
        className="fixed w-56 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-200"
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
      >
        <p className="mb-2.5 text-sm font-medium text-slate-900">
          {isRecurring ? "Delete recurring event" : "Delete this event?"}
        </p>
        <div className="flex flex-col gap-1.5">
          {isRecurring ? (
            <>
              <button
                onClick={handleSingle}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Only this event
              </button>
              {onDeleteFuture && (
                <button
                  onClick={handleFuture}
                  disabled={isDeleting}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  This & all future
                </button>
              )}
            </>
          ) : (
            <button
              onClick={handleSingle}
              disabled={isDeleting}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl px-3 py-2 text-center text-sm text-slate-500 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onDeleteFutureRecurring,
  initialData,
  selectedDate,
  selectedStartTime,
  selectedEndTime
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onDeleteFutureRecurring?: () => Promise<void>;
  initialData?: EventData;
  selectedDate?: Date;
  selectedStartTime?: string;
  selectedEndTime?: string;
}) {
  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    location: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletePopoverPos, setDeletePopoverPos] = useState<{ x: number; y: number } | null>(null);

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
        startTime: selectedStartTime || "09:00",
        endTime: selectedEndTime || "10:00",
        location: ""
      });
    }
    setDeletePopoverPos(null);
  }, [initialData, selectedDate, selectedStartTime, selectedEndTime, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {initialData ? "Edit Event" : "New Event"}
          </h2>
          <div className="flex items-center gap-1">
            {onDelete && initialData && (
              <button
                type="button"
                onClick={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setDeletePopoverPos({ x: rect.left, y: rect.bottom + 8 });
                }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 cursor-pointer"
                aria-label="Delete event"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <fieldset disabled={isSaving} className="space-y-4">
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
          </fieldset>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "Saving..." : initialData ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </form>

        {/* Delete popover (triggered from trash icon in header) */}
        {deletePopoverPos && initialData && onDelete && (
          <DeletePopover
            event={initialData}
            position={deletePopoverPos}
            onDeleteSingle={async () => { await onDelete(); }}
            onDeleteFuture={onDeleteFutureRecurring}
            onClose={() => setDeletePopoverPos(null)}
          />
        )}
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
  const [selectedStartTime, setSelectedStartTime] = useState<string | undefined>();
  const [selectedEndTime, setSelectedEndTime] = useState<string | undefined>();
  const seededRef = useRef(false);
  const currentTimeRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  // Selected day for keyboard navigation (null = none selected)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Ghost event from AI chat (pending confirmation)
  const [ghostEvent, setGhostEvent] = useState<{
    title: string;
    start: number;
    end: number;
    location?: string;
  } | null>(null);

  // Delete popover state (for hover × on events)
  const [deletePopoverEvent, setDeletePopoverEvent] = useState<EventData | null>(null);
  const [deletePopoverPos, setDeletePopoverPos] = useState<{ x: number; y: number } | null>(null);

  // Current time for the time indicator
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to current time indicator once the grid is rendered
  useEffect(() => {
    if (hasScrolledRef.current || !currentTimeRef.current) return;
    hasScrolledRef.current = true;
    const timer = setTimeout(() => {
      currentTimeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  });

  // Drag state for create, move, and resize operations
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [dragStart, setDragStart] = useState<DragInfo | null>(null);
  const [dragCurrent, setDragCurrent] = useState<DragInfo | null>(null);
  const [eventDragInfo, setEventDragInfo] = useState<EventDragInfo | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Use refs for synchronous access during mouse events
  const dragStartRef = useRef<DragInfo | null>(null);
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<DragMode | null>(null);
  const eventDragInfoRef = useRef<EventDragInfo | null>(null);
  // Track initial mouse position for drag threshold
  const mouseStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDragStartedRef = useRef(false);

  const events = useQuery(api.events.getWeekEvents, {
    weekStart: currentWeekStart.getTime()
  });
  const seedDemo = useMutation(api.events.seedDemo);
  const createEvent = useMutation(api.events.createEvent);
  const updateEvent = useMutation(api.events.updateEvent);
  const deleteEvent = useMutation(api.events.deleteEvent);
  const deleteRecurringEvents = useMutation(api.events.deleteRecurringEvents);
  const enableAutoDemoSeed =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_SEED === "true";

  useEffect(() => {
    if (!enableAutoDemoSeed) return;

    if (events && events.length === 0 && !seededRef.current) {
      seededRef.current = true;
      void seedDemo();
    }
  }, [enableAutoDemoSeed, events, seedDemo]);

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

  // Calculate time range based on events and current time
  const { startHour, endHour, timeSlots } = useMemo(() => {
    let minHour = DEFAULT_START_HOUR;
    let maxHour = DEFAULT_END_HOUR;

    // Expand range to include current time so the indicator is always visible
    const nowHour = currentTime.getHours();
    if (nowHour < DEFAULT_START_HOUR) {
      minHour = EXTENDED_START_HOUR;
    }
    if (nowHour >= DEFAULT_END_HOUR) {
      maxHour = EXTENDED_END_HOUR;
    }

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
  }, [events, currentTime]);

  // Position events in the grid
  const eventPositions = useMemo(() => {
    if (!events) return [];

    return events.map((event) => {
      const startDate = new Date(event.start);
      const endDate = new Date(event.end);

      const dayIndex = startDate.getDay();

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

  // Position ghost event for the calendar overlay
  const ghostEventPosition = useMemo(() => {
    if (!ghostEvent) return null;

    const startDate = new Date(ghostEvent.start);
    const endDate = new Date(ghostEvent.end);

    const dayIndex = startDate.getDay();

    // Check if ghost event is in the current week
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    if (startDate < currentWeekStart || startDate >= weekEnd) return null;

    const eventStartHour = startDate.getHours() + startDate.getMinutes() / 60;
    const eventEndHour = endDate.getHours() + endDate.getMinutes() / 60;

    const top = ((eventStartHour - startHour) / (endHour - startHour)) * 100;
    const height = ((eventEndHour - eventStartHour) / (endHour - startHour)) * 100;

    return {
      title: ghostEvent.title,
      dayIndex,
      top: Math.max(0, top),
      height: Math.min(100 - Math.max(0, top), height),
      startTime: formatTime(startDate),
      endTime: formatTime(endDate),
    };
  }, [ghostEvent, startHour, endHour, currentWeekStart]);

  // Auto-navigate to ghost event's week when it's created
  useEffect(() => {
    if (!ghostEvent) return;
    const ghostDate = new Date(ghostEvent.start);
    const ghostWeekStart = getWeekStart(ghostDate);
    if (ghostWeekStart.getTime() !== currentWeekStart.getTime()) {
      setCurrentWeekStart(ghostWeekStart);
    }
  }, [ghostEvent, currentWeekStart]);

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

      if (endDate <= startDate) {
        alert("End time must be after start time");
        return;
      }

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

  const handleDeleteFutureRecurring = useCallback(async () => {
    if (editingEvent?.recurrence) {
      await deleteRecurringEvents({
        recurrenceId: editingEvent.recurrence,
        fromStart: editingEvent.start,
      });
      setModalOpen(false);
      setEditingEvent(null);
    }
  }, [editingEvent, deleteRecurringEvents]);

  // Delete via the hover × popover (not through the edit modal)
  const handlePopoverDeleteSingle = useCallback(async () => {
    if (deletePopoverEvent) {
      await deleteEvent({ id: deletePopoverEvent._id });
      setDeletePopoverEvent(null);
      setDeletePopoverPos(null);
    }
  }, [deletePopoverEvent, deleteEvent]);

  const handlePopoverDeleteFuture = useCallback(async () => {
    if (deletePopoverEvent?.recurrence) {
      await deleteRecurringEvents({
        recurrenceId: deletePopoverEvent.recurrence,
        fromStart: deletePopoverEvent.start,
      });
      setDeletePopoverEvent(null);
      setDeletePopoverPos(null);
    }
  }, [deletePopoverEvent, deleteRecurringEvents]);

  const openNewEventModal = useCallback((date?: Date, startTime?: string, endTime?: string) => {
    setEditingEvent(null);
    setSelectedDate(date);
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
    setModalOpen(true);
  }, []);

  const openEditEventModal = useCallback((event: EventData) => {
    setEditingEvent(event);
    setSelectedDate(undefined);
    setSelectedStartTime(undefined);
    setSelectedEndTime(undefined);
    setDeletePopoverEvent(null);
    setDeletePopoverPos(null);
    setModalOpen(true);
  }, []);

  // Calculate time from mouse position within the grid
  const getTimeFromMouseEvent = useCallback((e: React.MouseEvent | MouseEvent): { dayIndex: number; time: number } | null => {
    if (!gridRef.current) return null;

    const gridRect = gridRef.current.getBoundingClientRect();
    const timeColumnWidth = 80; // 80px for time labels
    const gap = 8; // gap-2 = 0.5rem = 8px

    // Calculate x position relative to the day columns (excluding time column)
    const x = e.clientX - gridRect.left - timeColumnWidth - gap;
    const y = e.clientY - gridRect.top;

    // Calculate available width for day columns
    const dayColumnsWidth = gridRect.width - timeColumnWidth - gap;
    const dayWidth = dayColumnsWidth / 7;

    // Determine which day column
    const dayIndex = Math.floor(x / dayWidth);
    if (dayIndex < 0 || dayIndex > 6) return null;

    // Calculate time based on y position
    const gridHeight = gridRect.height;
    const totalHours = endHour - startHour;
    const hourHeight = gridHeight / totalHours;

    const hoursFromTop = y / hourHeight;
    const time = startHour + hoursFromTop;

    // Clamp to valid range
    const clampedTime = Math.max(startHour, Math.min(endHour, time));
    const snappedTime = snapToTimeIncrement(clampedTime);

    return { dayIndex, time: snappedTime };
  }, [startHour, endHour]);

  // Reset all drag state
  const resetDragState = useCallback(() => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    dragModeRef.current = null;
    eventDragInfoRef.current = null;
    mouseStartPosRef.current = null;
    hasDragStartedRef.current = false;
    setIsDragging(false);
    setDragMode(null);
    setDragStart(null);
    setDragCurrent(null);
    setEventDragInfo(null);
  }, []);

  // Handle event resize (from top or bottom edge)
  const handleEventResizeStart = useCallback((e: React.MouseEvent, event: EventData, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();

    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const dayIndex = startDate.getDay();

    const info = getTimeFromMouseEvent(e);
    if (!info) return;

    // Set refs synchronously
    isDraggingRef.current = true;
    dragModeRef.current = edge === 'top' ? 'resize-top' : 'resize-bottom';
    dragStartRef.current = info;
    eventDragInfoRef.current = {
      event,
      originalStart: startDate.getHours() + startDate.getMinutes() / 60,
      originalEnd: endDate.getHours() + endDate.getMinutes() / 60,
      dayIndex
    };
    mouseStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDragStartedRef.current = true; // Skip threshold for resize

    setIsDragging(true);
    setDragMode(edge === 'top' ? 'resize-top' : 'resize-bottom');
    setDragStart(info);
    setDragCurrent(info);
    setEventDragInfo({
      event,
      originalStart: startDate.getHours() + startDate.getMinutes() / 60,
      originalEnd: endDate.getHours() + endDate.getMinutes() / 60,
      dayIndex
    });
  }, [getTimeFromMouseEvent]);

  // Handle event move start (from clicking on event body)
  const handleEventMoveStart = useCallback((e: React.MouseEvent, event: EventData) => {
    // Don't start move if clicking on resize handles or delete button
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
    if ((e.target as HTMLElement).closest('[data-delete-button]')) return;

    e.stopPropagation();
    e.preventDefault();

    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const dayIndex = startDate.getDay();

    const info = getTimeFromMouseEvent(e);
    if (!info) return;

    // Set refs synchronously
    isDraggingRef.current = true;
    dragModeRef.current = 'move';
    dragStartRef.current = info;
    eventDragInfoRef.current = {
      event,
      originalStart: startDate.getHours() + startDate.getMinutes() / 60,
      originalEnd: endDate.getHours() + endDate.getMinutes() / 60,
      dayIndex
    };
    mouseStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDragStartedRef.current = false; // Will start after threshold

    setDragMode('move');
    setDragStart(info);
    setEventDragInfo({
      event,
      originalStart: startDate.getHours() + startDate.getMinutes() / 60,
      originalEnd: endDate.getHours() + endDate.getMinutes() / 60,
      dayIndex
    });
  }, [getTimeFromMouseEvent]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Prevent drag when clicking on events (they have their own handlers)
    if ((e.target as HTMLElement).closest('[data-event]')) return;

    const info = getTimeFromMouseEvent(e);
    if (!info) return;

    // Set refs synchronously for immediate access
    isDraggingRef.current = true;
    dragModeRef.current = 'create';
    dragStartRef.current = info;
    mouseStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDragStartedRef.current = false; // Will start after threshold

    setDragMode('create');
    setDragStart(info);
    setDragCurrent(info);
    e.preventDefault();
  }, [getTimeFromMouseEvent]);

  const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!isDraggingRef.current) return;

    // Check if we've passed the drag threshold
    if (!hasDragStartedRef.current && mouseStartPosRef.current) {
      const dx = e.clientX - mouseStartPosRef.current.x;
      const dy = e.clientY - mouseStartPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < DRAG_THRESHOLD_PX) {
        return; // Haven't moved enough yet
      }
      hasDragStartedRef.current = true;
      setIsDragging(true);
    }

    const info = getTimeFromMouseEvent(e);
    if (!info) return;

    const mode = dragModeRef.current;

    if (mode === 'create') {
      // For create mode, only allow dragging within the same day
      if (dragStartRef.current && info.dayIndex === dragStartRef.current.dayIndex) {
        setDragCurrent(info);
      }
    } else if (mode === 'move' && eventDragInfoRef.current) {
      // For move mode, allow moving to different days
      setDragCurrent(info);
    } else if ((mode === 'resize-top' || mode === 'resize-bottom') && eventDragInfoRef.current) {
      // For resize, keep the same day
      if (info.dayIndex === eventDragInfoRef.current.dayIndex) {
        setDragCurrent(info);
      }
    }
  }, [getTimeFromMouseEvent]);

  const handleMouseUp = useCallback(async () => {
    // Check if we actually dragged (passed threshold)
    if (!isDraggingRef.current || !hasDragStartedRef.current) {
      // If we didn't pass threshold, treat as click for events
      if (dragModeRef.current === 'move' && eventDragInfoRef.current) {
        openEditEventModal(eventDragInfoRef.current.event);
      }
      resetDragState();
      return;
    }

    const mode = dragModeRef.current;
    const dragStartInfo = dragStartRef.current;
    const dragCurrentInfo = dragCurrent || dragStartInfo;

    if (!dragStartInfo || !dragCurrentInfo) {
      resetDragState();
      return;
    }

    if (mode === 'create') {
      // Create new event
      const dayIndex = dragStartInfo.dayIndex;
      const eventStartTime = Math.min(dragStartInfo.time, dragCurrentInfo.time);
      let eventEndTime = Math.max(dragStartInfo.time, dragCurrentInfo.time);

      // Ensure minimum 15-minute duration
      if (eventEndTime - eventStartTime < 0.25) {
        eventEndTime = eventStartTime + 0.25;
      }

      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + dayIndex);

      openNewEventModal(date, hoursToTimeString(eventStartTime), hoursToTimeString(eventEndTime));
    } else if (mode === 'move' && eventDragInfoRef.current) {
      // Move existing event
      const eventInfo = eventDragInfoRef.current;
      const timeDiff = dragCurrentInfo.time - dragStartInfo.time;

      const newStartTime = eventInfo.originalStart + timeDiff;
      const newEndTime = eventInfo.originalEnd + timeDiff;

      // Calculate new date
      const newDate = new Date(currentWeekStart);
      newDate.setDate(currentWeekStart.getDate() + dragCurrentInfo.dayIndex);

      const newStart = new Date(newDate);
      newStart.setHours(Math.floor(newStartTime), Math.round((newStartTime % 1) * 60), 0, 0);

      const newEnd = new Date(newDate);
      newEnd.setHours(Math.floor(newEndTime), Math.round((newEndTime % 1) * 60), 0, 0);

      await updateEvent({
        id: eventInfo.event._id,
        title: eventInfo.event.title,
        description: eventInfo.event.description,
        start: newStart.getTime(),
        end: newEnd.getTime(),
        location: eventInfo.event.location
      });
    } else if ((mode === 'resize-top' || mode === 'resize-bottom') && eventDragInfoRef.current) {
      // Resize existing event
      const eventInfo = eventDragInfoRef.current;
      let newStartTime = eventInfo.originalStart;
      let newEndTime = eventInfo.originalEnd;

      if (mode === 'resize-top') {
        newStartTime = Math.min(dragCurrentInfo.time, eventInfo.originalEnd - 0.25);
      } else {
        newEndTime = Math.max(dragCurrentInfo.time, eventInfo.originalStart + 0.25);
      }

      const originalDate = new Date(eventInfo.event.start);
      const newStart = new Date(originalDate);
      newStart.setHours(Math.floor(newStartTime), Math.round((newStartTime % 1) * 60), 0, 0);

      const newEnd = new Date(originalDate);
      newEnd.setHours(Math.floor(newEndTime), Math.round((newEndTime % 1) * 60), 0, 0);

      await updateEvent({
        id: eventInfo.event._id,
        title: eventInfo.event.title,
        description: eventInfo.event.description,
        start: newStart.getTime(),
        end: newEnd.getTime(),
        location: eventInfo.event.location
      });
    }

    resetDragState();
  }, [dragCurrent, currentWeekStart, openNewEventModal, openEditEventModal, resetDragState, updateEvent]);

  // Handle keyboard navigation (arrows, escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingRef.current) {
        resetDragState();
        return;
      }

      // Don't handle arrow keys when typing in inputs/textareas or modals are open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        modalOpen
      ) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedDayIndex((prev) => {
          if (prev === null) return 0;
          if (prev >= 6) {
            // Move to next week
            navigateWeek(1);
            return 0;
          }
          return prev + 1;
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedDayIndex((prev) => {
          if (prev === null) return 6;
          if (prev <= 0) {
            // Move to previous week
            navigateWeek(-1);
            return 6;
          }
          return prev - 1;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetDragState, modalOpen, navigateWeek]);

  // Handle mouse up outside the grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        handleMouseUp();
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        handleMouseMove(e);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [handleMouseUp, handleMouseMove]);

  // Calculate drag preview position for all drag modes
  const dragPreview = useMemo(() => {
    if (!isDragging || !dragStart || !dragCurrent) return null;

    if (dragMode === 'create') {
      const previewStartTime = Math.min(dragStart.time, dragCurrent.time);
      const previewEndTime = Math.max(dragStart.time, dragCurrent.time);

      const top = ((previewStartTime - startHour) / (endHour - startHour)) * 100;
      const height = ((previewEndTime - previewStartTime) / (endHour - startHour)) * 100;

      return {
        type: 'create' as const,
        dayIndex: dragStart.dayIndex,
        top: Math.max(0, top),
        height: Math.max(height, 2),
        startTime: hoursToTimeString(previewStartTime),
        endTime: hoursToTimeString(previewEndTime)
      };
    } else if (dragMode === 'move' && eventDragInfo) {
      const timeDiff = dragCurrent.time - dragStart.time;
      const newStartTime = eventDragInfo.originalStart + timeDiff;
      const newEndTime = eventDragInfo.originalEnd + timeDiff;

      const top = ((newStartTime - startHour) / (endHour - startHour)) * 100;
      const height = ((newEndTime - newStartTime) / (endHour - startHour)) * 100;

      return {
        type: 'move' as const,
        dayIndex: dragCurrent.dayIndex,
        originalDayIndex: eventDragInfo.dayIndex,
        eventId: eventDragInfo.event._id,
        top: Math.max(0, top),
        height: Math.max(height, 2),
        startTime: hoursToTimeString(newStartTime),
        endTime: hoursToTimeString(newEndTime)
      };
    } else if ((dragMode === 'resize-top' || dragMode === 'resize-bottom') && eventDragInfo) {
      let newStartTime = eventDragInfo.originalStart;
      let newEndTime = eventDragInfo.originalEnd;

      if (dragMode === 'resize-top') {
        newStartTime = Math.min(dragCurrent.time, eventDragInfo.originalEnd - 0.25);
      } else {
        newEndTime = Math.max(dragCurrent.time, eventDragInfo.originalStart + 0.25);
      }

      const top = ((newStartTime - startHour) / (endHour - startHour)) * 100;
      const height = ((newEndTime - newStartTime) / (endHour - startHour)) * 100;

      return {
        type: 'resize' as const,
        dayIndex: eventDragInfo.dayIndex,
        eventId: eventDragInfo.event._id,
        top: Math.max(0, top),
        height: Math.max(height, 2),
        startTime: hoursToTimeString(newStartTime),
        endTime: hoursToTimeString(newEndTime)
      };
    }

    return null;
  }, [isDragging, dragMode, dragStart, dragCurrent, eventDragInfo, startHour, endHour]);

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
    <main className="mx-auto max-w-[1600px] px-6 py-6 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek(-1)}
              className="cursor-pointer rounded-full border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
              aria-label="Previous week"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="min-w-[160px] text-center text-sm font-medium text-slate-700">
              {weekLabel}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              className="cursor-pointer rounded-full border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
              aria-label="Next week"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              disabled={isCurrentWeek}
              className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:opacity-50"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]" style={{ height: "calc(100vh - 80px)" }}>
        <section className="overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-2 border-b border-slate-100 pb-4">
            <div />
            {days.map((day) => {
              const isToday =
                day.fullDate.toDateString() === new Date().toDateString();
              const isWeekend = day.dayIndex === 0 || day.dayIndex === 6;
              const isSelected = selectedDayIndex === day.dayIndex;
              return (
                <div
                  key={day.label}
                  onClick={() => setSelectedDayIndex(day.dayIndex)}
                  className={`space-y-1 rounded-lg py-1 text-center text-xs font-semibold cursor-pointer transition-colors ${isSelected ? "bg-indigo-50 ring-1 ring-indigo-200" : isWeekend ? "bg-slate-50" : "hover:bg-slate-50"}`}
                >
                  <p
                    className={
                      isToday ? "text-indigo-600" : isWeekend ? "text-slate-400" : "text-slate-900"
                    }
                  >
                    {day.label}
                  </p>
                  <p
                    className={`${isToday ? "rounded-full bg-indigo-600 text-white" : isWeekend ? "text-slate-400" : "text-slate-500"} mx-auto w-fit px-2 py-1`}
                  >
                    {day.date}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div
            ref={gridRef}
            className={`relative mt-4 select-none ${isDragging ? 'cursor-grabbing' : ''}`}
            onMouseDown={handleMouseDown}
          >
            <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-2">
              {timeSlots.map((hour) => (
                <div key={hour} className="contents">
                  <div className="flex h-16 items-start justify-end pr-3 text-xs font-medium text-slate-400">
                    {formatTimeSlot(hour)}
                  </div>
                  {days.map((day) => {
                    const isWeekend = day.dayIndex === 0 || day.dayIndex === 6;
                    const isSelected = selectedDayIndex === day.dayIndex;
                    return (
                      <div
                        key={`${day.label}-${hour}`}
                        className={`h-16 border-t border-slate-100 hover:bg-indigo-50/50 ${isSelected ? 'bg-indigo-50/40' : isWeekend ? 'bg-slate-50/80' : ''} ${isDragging ? '' : 'cursor-crosshair'}`}
                      />
                    );
                  })}
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
                    .map((event) => {
                      const isBeingDragged = isDragging && eventDragInfo?.event._id === event._id;
                      return (
                        <div
                          key={event._id}
                          data-event="true"
                          onMouseDown={(e) => handleEventMoveStart(e, event)}
                          className={`group pointer-events-auto absolute left-1 right-1 overflow-hidden rounded-lg border border-indigo-200 bg-indigo-100 shadow-sm transition ${
                            isBeingDragged ? 'opacity-50' : 'hover:bg-indigo-200'
                          } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                          style={{
                            top: `${event.top}%`,
                            height: `${Math.max(event.height, 8)}%`
                          }}
                        >
                          {/* Top resize handle */}
                          <div
                            data-resize-handle="true"
                            onMouseDown={(e) => handleEventResizeStart(e, event, 'top')}
                            className="absolute inset-x-0 top-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-indigo-300/50"
                          />

                          {/* Quick delete button — appears on hover */}
                          <button
                            data-delete-button="true"
                            onMouseDown={(e) => {
                              // Stop event from triggering drag/click-to-edit
                              e.stopPropagation();
                              e.preventDefault();
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setDeletePopoverEvent(event);
                              setDeletePopoverPos({ x: rect.right + 4, y: rect.top });
                            }}
                            className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-slate-400 opacity-0 shadow-sm ring-1 ring-slate-200/60 transition hover:bg-red-50 hover:text-red-500 hover:ring-red-200 group-hover:opacity-100 cursor-pointer"
                            aria-label="Delete event"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>

                          {/* Event content */}
                          <div className="p-2 pt-2">
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

                          {/* Bottom resize handle */}
                          <div
                            data-resize-handle="true"
                            onMouseDown={(e) => handleEventResizeStart(e, event, 'bottom')}
                            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-indigo-300/50"
                          />
                        </div>
                      );
                    })}

                  {/* Ghost event preview (AI proposal) */}
                  {ghostEventPosition && ghostEventPosition.dayIndex === dayIdx && (
                    <div
                      className="pointer-events-none absolute left-1 right-1 animate-pulse rounded-lg border-2 border-dashed border-green-400 bg-green-100/60"
                      style={{
                        top: `${ghostEventPosition.top}%`,
                        height: `${Math.max(ghostEventPosition.height, 8)}%`
                      }}
                    >
                      <div className="p-2">
                        <p className="truncate text-xs font-semibold text-green-800">
                          {ghostEventPosition.title}
                        </p>
                        {ghostEventPosition.height > 12 && (
                          <p className="truncate text-xs text-green-700">
                            {ghostEventPosition.startTime}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Drag preview overlay */}
                  {dragPreview && dragPreview.dayIndex === dayIdx && (
                    <div
                      className={`pointer-events-none absolute left-1 right-1 rounded-lg border-2 border-dashed ${
                        dragPreview.type === 'create'
                          ? 'border-indigo-400 bg-indigo-100/70'
                          : 'border-indigo-500 bg-indigo-200/80'
                      }`}
                      style={{
                        top: `${dragPreview.top}%`,
                        height: `${Math.max(dragPreview.height, 2)}%`
                      }}
                    >
                      <p className="truncate p-1 text-xs font-medium text-indigo-700">
                        {dragPreview.startTime} - {dragPreview.endTime}
                      </p>
                    </div>
                  )}

                  {/* Current time indicator */}
                  {day.fullDate.toDateString() === currentTime.toDateString() && (() => {
                    const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
                    if (currentHour < startHour || currentHour > endHour) return null;
                    const topPercent = ((currentHour - startHour) / (endHour - startHour)) * 100;
                    return (
                      <div
                        ref={currentTimeRef}
                        className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                        style={{ top: `${topPercent}%` }}
                      >
                        <div className="h-3 w-3 -ml-1.5 rounded-full bg-red-500" />
                        <div className="h-0.5 flex-1 bg-red-500" />
                      </div>
                    );
                  })()}
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

        <aside className="min-h-0">
          <ChatPanel onGhostEventChange={setGhostEvent} />
        </aside>
      </div>

      <EventModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEvent(null);
          setSelectedDate(undefined);
          setSelectedStartTime(undefined);
          setSelectedEndTime(undefined);
        }}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        onDeleteFutureRecurring={editingEvent?.recurrence ? handleDeleteFutureRecurring : undefined}
        initialData={editingEvent || undefined}
        selectedDate={selectedDate}
        selectedStartTime={selectedStartTime}
        selectedEndTime={selectedEndTime}
      />

      {/* Delete popover from hover × button on events */}
      {deletePopoverEvent && deletePopoverPos && (
        <DeletePopover
          event={deletePopoverEvent}
          position={deletePopoverPos}
          onDeleteSingle={handlePopoverDeleteSingle}
          onDeleteFuture={deletePopoverEvent.recurrence ? handlePopoverDeleteFuture : undefined}
          onClose={() => {
            setDeletePopoverEvent(null);
            setDeletePopoverPos(null);
          }}
        />
      )}
    </main>
  );
}
