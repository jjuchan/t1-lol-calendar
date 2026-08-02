import { RECENT_HEAD_TO_HEAD_LIMIT } from "./config/headToHead";
import { isTargetTeamCode } from "./config/filter";
import { TBD_CODE } from "./config/teamNames";
import type { HeadToHeadSummary, LolEsportsTeam, ScheduleEventWithCompetition } from "./types";

interface HeadToHeadEntry {
  date: string;
  won: boolean;
  competitionName: string;
}

export type HeadToHeadIndex = Map<string, HeadToHeadEntry[]>;

export function buildHeadToHeadIndex(events: ScheduleEventWithCompetition[]): HeadToHeadIndex {
  const index: HeadToHeadIndex = new Map();

  for (const event of events) {
    if (event.type !== "match" || event.state !== "completed" || !event.match) continue;
    const teams = event.match.teams;
    if (teams.length !== 2) continue;
    const [first, second] = teams as [LolEsportsTeam, LolEsportsTeam];

    let t1: LolEsportsTeam;
    let opponent: LolEsportsTeam;
    if (isTargetTeamCode(first.code)) {
      t1 = first;
      opponent = second;
    } else if (isTargetTeamCode(second.code)) {
      t1 = second;
      opponent = first;
    } else {
      continue;
    }

    const won = (t1.result?.gameWins ?? 0) > (opponent.result?.gameWins ?? 0);
    const list = index.get(opponent.code) ?? [];
    list.push({ date: event.startTime, won, competitionName: event.competition.name });
    index.set(opponent.code, list);
  }

  for (const list of index.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  return index;
}

export function getRecentHeadToHead(
  index: HeadToHeadIndex,
  opponentCode: string,
  cutoffIsoDateTime: string
): HeadToHeadSummary | null {
  if (opponentCode === TBD_CODE) return null;

  const entries = index.get(opponentCode);
  if (!entries || entries.length === 0) return null;

  const cutoffMs = new Date(cutoffIsoDateTime).getTime();
  const priorEntries = entries.filter((entry) => new Date(entry.date).getTime() <= cutoffMs);
  if (priorEntries.length === 0) return null;

  const recent = priorEntries.slice(-RECENT_HEAD_TO_HEAD_LIMIT);
  const wins = recent.filter((entry) => entry.won).length;

  const countByCompetition = new Map<string, number>();
  for (const entry of recent) {
    countByCompetition.set(entry.competitionName, (countByCompetition.get(entry.competitionName) ?? 0) + 1);
  }
  const competitions = Array.from(countByCompetition.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { wins, losses: recent.length - wins, competitions };
}
