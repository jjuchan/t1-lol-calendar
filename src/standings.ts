import { REGULAR_SEASON_BLOCK_PATTERN, STANDINGS_GROUP_SECTION_TYPES } from "./config/standings";
import { fetchScheduleSince, fetchStandings, fetchTournamentsForLeague } from "./lolesportsClient";
import { logger } from "./logger";
import type { GroupStandings, LolEsportsStandingsResponse, LolEsportsTournament, StandingsRow } from "./types";

interface MatchLogEntry {
  /** ISO 8601 UTC 문자열. 경기 날짜 기준으로 순위를 다시 계산할 때 이 값으로 자른다. */
  date: string;
  won: boolean;
  setWins: number;
  setLosses: number;
}

/**
 * 특정 리그의 "T1이 속한 그룹" 순위를 날짜별로 다시 계산할 수 있도록 필요한 원본 데이터.
 * 한 리그당 한 번만 만들어서 여러 경기에 재사용한다(경기마다 API를 다시 부르지 않는다).
 */
export interface LeagueStandingsContext {
  groupName: string;
  groupCodes: string[];
  matchLogByCode: Map<string, MatchLogEntry[]>;
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

/** 스탠딩 응답에서 "그룹 타입" 랭킹(플레이오프 대진표 제외)만 모아 team code -> 그룹명을 뽑는다. */
function extractGroupMembership(standings: LolEsportsStandingsResponse): Map<string, string> {
  const groupByCode = new Map<string, string>();

  for (const stage of standings.data.standings[0]?.stages ?? []) {
    for (const section of stage.sections) {
      if (!STANDINGS_GROUP_SECTION_TYPES.has(section.type)) continue;
      for (const ranking of section.rankings ?? []) {
        for (const team of ranking.teams) {
          groupByCode.set(team.code, section.name);
        }
      }
    }
  }

  return groupByCode;
}

const TARGET_CODE = "T1";

/**
 * T1이 현재 속한 그룹(예: Legend Group)의 경기 로그를 만든다. 이후 standingsAsOf()로
 * 원하는 날짜 시점의 순위표를 얼마든지 다시 계산할 수 있다.
 *
 * 그룹 정보가 아예 없는 시기(토너먼트 대진표만 진행 중이거나 시즌 사이 공백기)에는
 * null을 반환하고, DESCRIPTION에서 이 섹션은 생략된다. 실패해도 예외를 던지지 않고
 * null을 반환해 전체 파이프라인을 막지 않는다.
 */
export async function buildLeagueStandingsContext(leagueId: string): Promise<LeagueStandingsContext | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tournaments = await fetchTournamentsForLeague(leagueId);
    const { current, previous } = pickCurrentAndPrevious(tournaments, today);
    if (!current) return null;

    const currentStandings = await fetchStandings(current.id);
    const groupByCode = extractGroupMembership(currentStandings);

    const t1Group = groupByCode.get(TARGET_CODE);
    if (!t1Group) return null; // 지금은 그룹 순위 자체가 없는 시기(예: 토너먼트 대진표 기간)

    const groupCodes = Array.from(groupByCode.entries())
      .filter(([, group]) => group === t1Group)
      .map(([code]) => code);

    // 직전 토너먼트 성적까지 이어서 계산하기 위해, 그 시작일부터의 정규시즌 경기를 모은다.
    const sinceIsoDate = previous?.startDate ?? current.startDate;
    const events = await fetchScheduleSince(leagueId, sinceIsoDate);

    const matchLogByCode = new Map<string, MatchLogEntry[]>();
    for (const code of groupCodes) matchLogByCode.set(code, []);

    for (const event of events) {
      if (event.type !== "match" || event.state !== "completed" || !event.match) continue;
      if (event.startTime < sinceIsoDate) continue;
      if (!REGULAR_SEASON_BLOCK_PATTERN.test(event.blockName ?? "")) continue;

      const [a, b] = event.match.teams;
      if (!a || !b || event.match.teams.length !== 2) continue;

      const wa = a.result?.gameWins ?? 0;
      const wb = b.result?.gameWins ?? 0;

      for (const [code, setWins, setLosses] of [
        [a.code, wa, wb],
        [b.code, wb, wa],
      ] as const) {
        const log = matchLogByCode.get(code);
        if (!log) continue; // T1 그룹 소속이 아닌 팀(그룹 밖 상대와의 교차 경기)은 표에 넣지 않음
        log.push({ date: event.startTime, won: setWins > setLosses, setWins, setLosses });
      }
    }

    return { groupName: t1Group, groupCodes, matchLogByCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`순위표 컨텍스트 생성 실패 (leagueId=${leagueId}): ${message}`);
    return null;
  }
}

/** 주어진 시점(cutoffIsoDateTime) 기준으로, 그 시점까지 끝난 경기만 반영한 순위표를 계산한다. */
export function standingsAsOf(context: LeagueStandingsContext, cutoffIsoDateTime: string): GroupStandings {
  // 문자열을 그대로 비교하면 밀리초 표기 유무(예: "...00Z" vs "...00.000Z")에 따라
  // 같은 순간인데도 순서가 뒤바뀔 수 있어, 실제 타임스탬프(숫자)로 변환해 비교한다.
  const cutoffMs = new Date(cutoffIsoDateTime).getTime();
  const rows: Omit<StandingsRow, "rank">[] = context.groupCodes.map((code) => {
    const log = (context.matchLogByCode.get(code) ?? []).filter((entry) => new Date(entry.date).getTime() <= cutoffMs);
    const wins = log.filter((entry) => entry.won).length;
    const losses = log.length - wins;
    const setWins = log.reduce((sum, entry) => sum + entry.setWins, 0);
    const setLosses = log.reduce((sum, entry) => sum + entry.setLosses, 0);
    return { code, wins, losses, setWins, setLosses };
  });

  rows.sort((a, b) => {
    const winRateA = a.wins / Math.max(a.wins + a.losses, 1);
    const winRateB = b.wins / Math.max(b.wins + b.losses, 1);
    if (winRateB !== winRateA) return winRateB - winRateA;
    return b.setWins - b.setLosses - (a.setWins - a.setLosses);
  });

  return {
    groupName: context.groupName,
    rows: rows.map((row, index) => ({ ...row, rank: index + 1 })),
  };
}
