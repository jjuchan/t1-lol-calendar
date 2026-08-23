import { getTeamDisplay } from "./config/teamNames";
import { logger } from "./logger";
import type { CalendarEventInput, GroupStandings, HeadToHeadSummary, T1Match } from "./types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const ESTIMATED_DURATION_MINUTES: Record<number, number> = {
  1: 45,
  3: 120,
  5: 150,
};

function estimatedDurationMinutes(bestOf: number): number {
  return ESTIMATED_DURATION_MINUTES[bestOf] ?? 90;
}

function formatKstTime(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatKstDate(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

type MatchStatus = "scheduled" | "live" | "win" | "loss" | "no-result" | "postponed" | "cancelled" | "unknown";

function resolveStatus(match: T1Match): MatchStatus {
  const state = match.state.toLowerCase();

  if (state.includes("cancel")) return "cancelled";
  if (state.includes("postpone") || state.includes("delay")) return "postponed";

  if (state === "completed") {
    if (match.outcome === "win") return "win";
    if (match.outcome === "loss") return "loss";
    return "no-result";
  }
  if (state === "inprogress") return "live";
  if (state === "unstarted") return "scheduled";

  logger.warn(`알 수 없는 경기 상태: "${match.state}" (matchId=${match.matchId}), 기본값으로 처리합니다.`);
  return "unknown";
}

export function buildSummary(match: T1Match): string {
  const opponent = getTeamDisplay(match.opponent.code, match.opponent.name).short;
  const status = resolveStatus(match);

  switch (status) {
    case "win":
    case "loss":
    case "no-result":
      return `T1 ${match.t1Score}:${match.opponentScore} ${opponent}`;
    case "postponed":
      return `T1-${opponent} (연기)`;
    case "cancelled":
      return `T1-${opponent} (취소)`;
    case "live":
    case "scheduled":
    case "unknown":
    default:
      return `T1-${opponent}`;
  }
}

function buildStandingsLines(standings: GroupStandings): string[] {
  if (standings.rows.length === 0) return [];

  const lines: string[] = [];
  lines.push(`${standings.groupName ?? "순위"}`);
  for (const row of standings.rows) {
    const setDiff = row.setWins - row.setLosses;
    const setDiffPart = setDiff > 0 ? `+${setDiff}` : `${setDiff}`;
    const setPart = row.setWins + row.setLosses > 0 ? ` (세트 ${row.setWins}-${row.setLosses}, 득실 ${setDiffPart})` : "";
    lines.push(`${row.rank}위 ${row.code} ${row.wins}승${row.losses}패${setPart}`);
  }
  return lines;
}

export function buildDescription(
  match: T1Match,
  standings: GroupStandings | null = null,
  headToHead: HeadToHeadSummary | null = null
): string {
  const opponent = getTeamDisplay(match.opponent.code, match.opponent.name).full;
  const status = resolveStatus(match);

  const lines: string[] = [];
  lines.push(`🏆 ${match.competitionName}${match.blockName ? ` · ${match.blockName}` : ""}`);
  lines.push("");
  lines.push(`T1 vs ${opponent} (Bo${match.bestOf})`);

  if (headToHead && headToHead.length > 0) {
    const wins = headToHead.filter((entry) => entry.won).length;
    const losses = headToHead.length - wins;
    lines.push("");
    lines.push(`최근 상대전적 (${wins}승 ${losses}패)`);
    for (const entry of headToHead) {
      lines.push(`${formatKstDate(entry.date)} ${entry.competitionName} ${entry.won ? "승" : "패"}`);
    }
  }

  const standingsLines = standings ? buildStandingsLines(standings) : [];
  if (standingsLines.length > 0) {
    lines.push("");
    lines.push(...standingsLines);
  }

  lines.push("");
  lines.push("경기 시작");
  lines.push(`${formatKstTime(match.startTime)} (KST)`);

  if (status === "win" || status === "loss" || status === "no-result") {
    lines.push("");
    lines.push("결과");
    lines.push(`T1 ${match.t1Score} : ${match.opponentScore} ${opponent}`);
  } else if (status === "postponed") {
    lines.push("");
    lines.push("상태: 일정 연기됨 (정확한 시간은 공식 채널 확인 필요)");
  } else if (status === "cancelled") {
    lines.push("");
    lines.push("상태: 경기 취소됨");
  }

  lines.push("");
  lines.push("중계");
  lines.push(`https://lolesports.com/schedule?leagueId=${match.leagueId}`);

  return lines.join("\n");
}

export function toCalendarEventInput(
  match: T1Match,
  standings: GroupStandings | null = null,
  headToHead: HeadToHeadSummary | null = null
): CalendarEventInput {
  const durationMs = estimatedDurationMinutes(match.bestOf) * 60 * 1000;
  return {
    uid: match.uid,
    start: match.startTime,
    end: new Date(match.startTime.getTime() + durationMs),
    summary: buildSummary(match),
    description: buildDescription(match, standings, headToHead),
  };
}
