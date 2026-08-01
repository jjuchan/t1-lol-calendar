import { REGULAR_SEASON_BLOCK_PATTERN, STANDINGS_GROUP_SECTION_TYPES } from "./config/standings";
import { fetchScheduleSince, fetchStandings, fetchTournamentsForLeague } from "./lolesportsClient";
import { logger } from "./logger";
import type { GroupStandings, LolEsportsStandingsResponse, LolEsportsTournament, StandingsRow } from "./types";

interface Record_ {
  wins: number;
  losses: number;
}

/** 날짜(YYYY-MM-DD) 문자열 기준으로, 현재 진행 중인 토너먼트와 그 직전 토너먼트를 고른다. */
function pickCurrentAndPrevious(
  tournaments: LolEsportsTournament[],
  todayIsoDate: string
): { current: LolEsportsTournament | null; previous: LolEsportsTournament | null } {
  const started = tournaments.filter((t) => t.startDate <= todayIsoDate).sort((a, b) => a.startDate.localeCompare(b.startDate));

  const current = started.at(-1) ?? null;
  const previous = started.length >= 2 ? started.at(-2)! : null;
  return { current, previous };
}

/** 스탠딩 응답에서 "그룹 타입" 랭킹(플레이오프 대진표 제외)만 모아 team code -> 정보를 뽑는다. */
function extractGroupSections(standings: LolEsportsStandingsResponse): {
  groupByCode: Map<string, string>;
  recordByCode: Map<string, Record_>;
} {
  const groupByCode = new Map<string, string>();
  const recordByCode = new Map<string, Record_>();

  for (const stage of standings.data.standings[0]?.stages ?? []) {
    for (const section of stage.sections) {
      if (!STANDINGS_GROUP_SECTION_TYPES.has(section.type)) continue;
      for (const ranking of section.rankings ?? []) {
        for (const team of ranking.teams) {
          groupByCode.set(team.code, section.name);
          if (team.record) {
            recordByCode.set(team.code, { wins: team.record.wins, losses: team.record.losses });
          }
        }
      }
    }
  }

  return { groupByCode, recordByCode };
}

function addRecords(base: Map<string, Record_>, extra: Map<string, Record_>): Map<string, Record_> {
  const combined = new Map(base);
  for (const [code, rec] of extra) {
    const existing = combined.get(code) ?? { wins: 0, losses: 0 };
    combined.set(code, { wins: existing.wins + rec.wins, losses: existing.losses + rec.losses });
  }
  return combined;
}

/** 정규시즌(Week N) 라운드만 골라 team code별 세트(게임) 득실을 집계한다. */
function computeSetDiffs(events: import("./types").LolEsportsScheduleEvent[], sinceIsoDate: string): Map<string, Record_> {
  const setDiffs = new Map<string, Record_>();

  for (const event of events) {
    if (event.type !== "match" || event.state !== "completed" || !event.match) continue;
    if (event.startTime < sinceIsoDate) continue;
    if (!REGULAR_SEASON_BLOCK_PATTERN.test(event.blockName ?? "")) continue;

    const [a, b] = event.match.teams;
    if (!a || !b || event.match.teams.length !== 2) continue;

    const wa = a.result?.gameWins ?? 0;
    const wb = b.result?.gameWins ?? 0;

    for (const [code, won, lost] of [
      [a.code, wa, wb],
      [b.code, wb, wa],
    ] as const) {
      const existing = setDiffs.get(code) ?? { wins: 0, losses: 0 };
      setDiffs.set(code, { wins: existing.wins + won, losses: existing.losses + lost });
    }
  }

  return setDiffs;
}

const TARGET_CODE = "T1";

/**
 * T1이 현재 속한 그룹의 순위표를 만든다. 그룹 정보가 아예 없는 시기(토너먼트 대진표만
 * 진행 중이거나 시즌 사이 공백기)에는 null을 반환하고, DESCRIPTION에서 이 섹션은 그냥
 * 생략된다. 실패해도 예외를 던지지 않고 null을 반환해 전체 파이프라인을 막지 않는다.
 */
export async function buildT1GroupStandings(leagueId: string): Promise<GroupStandings | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tournaments = await fetchTournamentsForLeague(leagueId);
    const { current, previous } = pickCurrentAndPrevious(tournaments, today);
    if (!current) return null;

    const currentStandings = await fetchStandings(current.id);
    const { groupByCode, recordByCode: currentRecords } = extractGroupSections(currentStandings);

    const t1Group = groupByCode.get(TARGET_CODE);
    if (!t1Group) return null; // 지금은 그룹 순위 자체가 없는 시기(예: 토너먼트 대진표 기간)

    let combinedRecords = currentRecords;
    if (previous) {
      const previousStandings = await fetchStandings(previous.id);
      combinedRecords = addRecords(currentRecords, extractGroupSections(previousStandings).recordByCode);
    }

    const sinceIsoDate = previous?.startDate ?? current.startDate;
    const events = await fetchScheduleSince(leagueId, sinceIsoDate);
    const setDiffs = computeSetDiffs(events, sinceIsoDate);

    const groupCodes = Array.from(groupByCode.entries())
      .filter(([, group]) => group === t1Group)
      .map(([code]) => code);

    const rows: Omit<StandingsRow, "rank">[] = groupCodes.map((code) => {
      const record = combinedRecords.get(code) ?? { wins: 0, losses: 0 };
      const setDiff = setDiffs.get(code) ?? { wins: 0, losses: 0 };
      return {
        code,
        wins: record.wins,
        losses: record.losses,
        setWins: setDiff.wins,
        setLosses: setDiff.losses,
      };
    });

    rows.sort((a, b) => {
      const winRateA = a.wins / Math.max(a.wins + a.losses, 1);
      const winRateB = b.wins / Math.max(b.wins + b.losses, 1);
      if (winRateB !== winRateA) return winRateB - winRateA;
      return b.setWins - b.setLosses - (a.setWins - a.setLosses);
    });

    return {
      groupName: t1Group,
      rows: rows.map((row, index) => ({ ...row, rank: index + 1 })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`순위표 계산 실패 (leagueId=${leagueId}): ${message}`);
    return null;
  }
}
