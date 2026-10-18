function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  );
  const wallClock = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return wallClock - Math.floor(date.getTime() / 1000) * 1000;
}

// Keeps the clinic's local start time across daylight-saving changes, so a
// weekly 9:00 AM appointment stays at 9:00 AM after the clocks move.
export function addWeeks(date: Date, weeks: number, timeZone: string) {
  const next = new Date(date.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  return new Date(
    next.getTime() + timeZoneOffsetMs(date, timeZone) - timeZoneOffsetMs(next, timeZone),
  );
}
export function formatAppointment(date: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(date));
}
