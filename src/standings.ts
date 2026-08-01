import { REGULAR_SEASON_BLOCK_PATTERN, STANDINGS_GROUP_SECTION_TYPES } from "./config/standings";
import { fetchScheduleSince, fetchStandings, fetchTournamentsForLeague } from "./lolesportsClient";
import { logger } from "./logger";
import type { GroupStandings, LolEsportsStandingsResponse, LolEsportsTournament, StandingsRow } from "./types";

interface MatchLogEntry {
  date: string;
  won: boolean;
  setWins: number;
  setLosses: number;
}

export interface LeagueStandingsContext {
  groupName: string;
  groupCodes: string[];
  matchLogByCode: Map<string, MatchLogEntry[]>;
}

function pickCurrentAndPrevious(
  tournaments: LolEsportsTournament[],
  todayIsoDate: string
): { current: LolEsportsTournament | null; previous: LolEsportsTournament | null } {
  const started = tournaments.filter((t) => t.startDate <= todayIsoDate).sort((a, b) => a.startDate.localeCompare(b.startDate));

  const current = started.at(-1) ?? null;
  const previous = started.length >= 2 ? started.at(-2)! : null;
  return { current, previous };
}

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

export async function buildLeagueStandingsContext(leagueId: string): Promise<LeagueStandingsContext | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tournaments = await fetchTournamentsForLeague(leagueId);
    const { current, previous } = pickCurrentAndPrevious(tournaments, today);
    if (!current) return null;

    const currentStandings = await fetchStandings(current.id);
    const groupByCode = extractGroupMembership(currentStandings);

    const t1Group = groupByCode.get(TARGET_CODE);
    if (!t1Group) return null;

    const groupCodes = Array.from(groupByCode.entries())
      .filter(([, group]) => group === t1Group)
      .map(([code]) => code);

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
        if (!log) continue;
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

export function standingsAsOf(context: LeagueStandingsContext, cutoffIsoDateTime: string): GroupStandings {
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
