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

function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  selectedDate,
  selectedStartTime,
  selectedEndTime
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventFormData) => void;
  onDelete?: () => void;
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
  }, [initialData, selectedDate, selectedStartTime, selectedEndTime, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
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
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
                  className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
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
  const [selectedStartTime, setSelectedStartTime] = useState<string | undefined>();
  const [selectedEndTime, setSelectedEndTime] = useState<string | undefined>();
  const seededRef = useRef(false);

  // Current time for the time indicator
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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
  }) as EventData[] | undefined;
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
    const dayOfWeek = startDate.getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

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
    // Don't start move if clicking on resize handles
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;

    e.stopPropagation();
    e.preventDefault();

    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const dayOfWeek = startDate.getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

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
      const dayDiff = dragCurrentInfo.dayIndex - eventInfo.dayIndex;

      const newStartTime = eventInfo.originalStart + timeDiff;
      const newEndTime = eventInfo.originalEnd + timeDiff;

      // Calculate new date
      const originalDate = new Date(eventInfo.event.start);
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

  // Handle escape key to cancel drag
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingRef.current) {
        resetDragState();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetDragState]);

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
              className="cursor-pointer rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
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
              className="cursor-pointer rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
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
            className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:opacity-50"
          >
            Today
          </button>
          <button
            onClick={() => openNewEventModal()}
            className="cursor-pointer rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
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
                  {days.map((day) => (
                    <div
                      key={`${day.label}-${hour}`}
                      className={`h-16 border-t border-slate-100 hover:bg-indigo-50/50 ${isDragging ? '' : 'cursor-crosshair'}`}
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

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">
                Today
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);

              const todayEvents = events?.filter((event) => {
                const eventDate = new Date(event.start);
                return eventDate >= today && eventDate < tomorrow;
              }).sort((a, b) => a.start - b.start) || [];

              if (todayEvents.length === 0) {
                return (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center">
                    <p className="text-sm text-slate-500">No events today</p>
                    <button
                      onClick={() => openNewEventModal(new Date())}
                      className="cursor-pointer mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      + Add an event
                    </button>
                  </div>
                );
              }

              return (
                <ul className="mt-4 space-y-3">
                  {todayEvents.map((event) => {
                    const startDate = new Date(event.start);
                    const endDate = new Date(event.end);
                    return (
                      <li
                        key={event._id}
                        onClick={() => openEditEventModal(event)}
                        className="group cursor-pointer rounded-xl border border-slate-100 p-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
                      >
                        <p className="font-medium text-slate-900 group-hover:text-indigo-900">
                          {event.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatTime(startDate)} – {formatTime(endDate)}
                        </p>
                        {event.location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {event.location}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </div>
          <div className="rounded-3xl border border-indigo-100 bg-indigo-600 p-6 text-white">
            <h2 className="text-lg font-semibold">This week</h2>
            <p className="mt-2 text-sm text-indigo-100">
              {events && events.length > 0
                ? `You have ${events.length} event${events.length > 1 ? "s" : ""} scheduled.`
                : "No events scheduled."}
            </p>
            <div className="mt-4">
              <button
                onClick={() => openNewEventModal()}
                className="cursor-pointer rounded-full bg-white/20 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/30"
              >
                + New event
              </button>
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
          setSelectedStartTime(undefined);
          setSelectedEndTime(undefined);
        }}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        initialData={editingEvent || undefined}
        selectedDate={selectedDate}
        selectedStartTime={selectedStartTime}
        selectedEndTime={selectedEndTime}
      />
    </main>
  );
}
