import { isTargetTeamCode, matchesExcludePattern } from "./config/filter";
import { logger } from "./logger";
import type { LolEsportsTeam, ScheduleEventWithCompetition, T1Match } from "./types";

const UID_DOMAIN = "t1-lol-calendar";

function buildUid(matchId: string): string {
  return `t1-${matchId}@${UID_DOMAIN}`;
}

function splitTeams(teams: LolEsportsTeam[]): { t1: LolEsportsTeam; opponent: LolEsportsTeam } | null {
  if (teams.length !== 2) return null;
  const [first, second] = teams as [LolEsportsTeam, LolEsportsTeam];

  if (isTargetTeamCode(first.code)) return { t1: first, opponent: second };
  if (isTargetTeamCode(second.code)) return { t1: second, opponent: first };
  return null;
}

export function filterT1Matches(events: ScheduleEventWithCompetition[]): T1Match[] {
  const matches: T1Match[] = [];

  for (const event of events) {
    if (event.type !== "match" || !event.match) continue;

    const split = splitTeams(event.match.teams);
    if (!split) continue;

    const { t1, opponent } = split;

    if (
      matchesExcludePattern(
        t1.name,
        t1.code,
        opponent.name,
        opponent.code,
        event.blockName ?? "",
        event.league.name
      )
    ) {
      logger.warn(`제외 패턴에 매칭되어 건너뜀: ${t1.code} vs ${opponent.code} (${event.blockName ?? "-"})`);
      continue;
    }

    matches.push({
      uid: buildUid(event.match.id),
      matchId: event.match.id,
      competitionId: event.competition.id,
      competitionName: event.competition.name,
      leagueId: event.competition.leagueId,
      blockName: event.blockName,
      startTime: new Date(event.startTime),
      state: event.state,
      bestOf: event.match.strategy?.count ?? 1,
      t1: { code: t1.code, name: t1.name },
      opponent: { code: opponent.code, name: opponent.name },
      t1Score: t1.result?.gameWins ?? 0,
      opponentScore: opponent.result?.gameWins ?? 0,
      outcome: t1.result?.outcome ?? null,
    });
  }

  return matches;
}
