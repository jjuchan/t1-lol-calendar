import * as fs from "node:fs";
import * as ical from "node-ical";
import { PAST_MATCH_RETENTION_DAYS } from "./config/retention";
import { logger } from "./logger";
import type { CalendarEventInput } from "./types";

type TextValue = string | { val: string } | undefined;

function toText(value: TextValue): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.val;
}

function readExistingEvents(path: string): Map<string, CalendarEventInput> {
  const map = new Map<string, CalendarEventInput>();

  if (!fs.existsSync(path)) {
    return map;
  }

  let content: string;
  try {
    content = fs.readFileSync(path, "utf-8");
  } catch (error) {
    logger.warn(`기존 ICS 파일을 읽지 못했습니다 (${path}): ${String(error)}`);
    return map;
  }

  let parsed: ical.CalendarResponse;
  try {
    parsed = ical.sync.parseICS(content);
  } catch (error) {
    logger.warn(`기존 ICS 파일 파싱에 실패했습니다 (${path}): ${String(error)}`);
    return map;
  }

  for (const component of Object.values(parsed)) {
    if (!component || component.type !== "VEVENT") continue;
    const uid = component.uid;
    if (!uid) continue;

    map.set(uid, {
      uid,
      start: new Date(component.start),
      end: new Date(component.end ?? component.start),
      summary: toText(component.summary),
      description: toText(component.description),
    });
  }

  return map;
}

function isWithinRetention(event: CalendarEventInput, now: Date): boolean {
  const cutoff = now.getTime() - PAST_MATCH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return event.end.getTime() >= cutoff;
}

export function mergeWithExisting(
  newMatches: CalendarEventInput[],
  existingPath: string,
  now: Date = new Date()
): CalendarEventInput[] {
  const merged = readExistingEvents(existingPath);

  let added = 0;
  let updated = 0;
  for (const match of newMatches) {
    if (merged.has(match.uid)) {
      updated++;
    } else {
      added++;
    }
    merged.set(match.uid, match);
  }

  const beforePruneCount = merged.size;
  const result = Array.from(merged.values()).filter((event) => isWithinRetention(event, now));
  const prunedCount = beforePruneCount - result.length;

  logger.info(
    `병합 결과: 신규 ${added}건, 갱신 ${updated}건, 보관기간(${PAST_MATCH_RETENTION_DAYS}일) 초과로 제거 ${prunedCount}건, 최종 ${result.length}건`
  );

  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}
