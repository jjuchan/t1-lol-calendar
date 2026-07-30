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

/**
 * 이전에 생성된 t1.ics를 읽어 uid -> 이벤트 맵으로 되돌린다.
 * Riot API의 일정 조회는 "현재 시점 근처"의 롤링 윈도우만 내려주기 때문에, 그 창을 벗어난
 * 과거 경기 기록을 계속 보존하려면 매번 이전 결과물을 읽어 새 결과와 병합해야 한다.
 */
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
  // 아직 시작하지 않았거나 진행 중/최근에 끝난 경기는 유지하고, 그보다 오래 전에
  // 끝난 경기만 정리한다.
  return event.end.getTime() >= cutoff;
}

/**
 * 새로 가져온 경기 데이터를 기존 t1.ics 내용과 병합한다.
 * - 같은 uid가 이미 있으면(예: 경기 결과가 나와 SUMMARY/DESCRIPTION만 갱신되는 경우)
 *   새 데이터로 덮어써서 "같은 일정이 업데이트"되도록 한다.
 * - 이번 수집 결과에 없는 uid(=API 윈도우 밖으로 밀려난 경기)는 최근 것이면 유지한다.
 * - PAST_MATCH_RETENTION_DAYS보다 오래 전에 끝난 경기는 구독 캘린더가 무한히
 *   커지지 않도록 자동으로 제거한다.
 */
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
