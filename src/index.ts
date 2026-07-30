import * as fs from "node:fs";
import * as path from "node:path";
import { COMPETITIONS } from "./config/competitions";
import { fetchAllMatches } from "./fetch";
import { filterT1Matches } from "./filter";
import { toCalendarEventInput } from "./format";
import { buildCalendar } from "./generate";
import { logger } from "./logger";
import { mergeWithExisting } from "./merge";

const OUTPUT_PATH = path.resolve(process.cwd(), "public", "t1.ics");

async function main(): Promise<void> {
  const enabled = COMPETITIONS.filter((c) => c.enabled);
  logger.info(`수집 대상 대회: ${enabled.map((c) => c.name).join(", ")}`);

  const { events, failures } = await fetchAllMatches(enabled);

  if (events.length === 0 && failures.length === enabled.length) {
    logger.error("모든 대회의 일정 수집에 실패했습니다. 기존 t1.ics를 그대로 유지하고 종료합니다.");
    process.exit(1);
  }

  if (failures.length > 0) {
    logger.warn(`${failures.length}개 대회 수집 실패, 나머지 데이터로 계속 진행합니다.`, failures);
  }

  const t1Matches = filterT1Matches(events);
  logger.info(`T1 1군 경기 ${t1Matches.length}건 필터링 완료`);

  const calendarInputs = t1Matches.map(toCalendarEventInput);
  const merged = mergeWithExisting(calendarInputs, OUTPUT_PATH);
  const ics = buildCalendar(merged);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, ics, "utf-8");

  logger.info(`t1.ics 생성 완료 (총 ${merged.length}개 이벤트) -> ${OUTPUT_PATH}`);
}

main().catch((error) => {
  logger.error("예상치 못한 오류로 종료합니다.", error instanceof Error ? error.stack : error);
  process.exit(1);
});
