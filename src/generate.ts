import ical, { ICalAlarmType } from "ical-generator";
import type { CalendarEventInput } from "./types";

const REMINDER_SECONDS_BEFORE_START = 30 * 60;

export function buildCalendar(events: CalendarEventInput[]): string {
  const calendar = ical({
    name: "T1 경기 일정",
    description: "T1 LCK/MSI/Worlds/EWC/First Stand/KeSPA Cup 1군 경기 일정 (자동 생성)",
    timezone: "UTC",
    prodId: { company: "t1-lol-calendar", product: "t1-ics", language: "KO" },
  });

  for (const event of events) {
    const vevent = calendar.createEvent({
      id: event.uid,
      start: event.start,
      end: event.end,
      timezone: "UTC",
      summary: event.summary,
      description: event.description,
    });

    vevent.createAlarm({
      type: ICalAlarmType.display,
      trigger: REMINDER_SECONDS_BEFORE_START,
    });
  }

  return calendar.toString();
}
