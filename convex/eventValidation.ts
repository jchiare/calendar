export const MAX_EVENT_DURATION_MS = 24 * 60 * 60 * 1000;

export function validateEvent(args: { title: string; start: number; end: number }) {
  if (!args.title.trim()) {
    throw new Error("Title cannot be empty");
  }

  if (args.end <= args.start) {
    throw new Error("End time must be after start time");
  }

  if (args.end - args.start > MAX_EVENT_DURATION_MS) {
    throw new Error("Event duration cannot exceed 24 hours");
  }
}
