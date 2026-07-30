import { getTeamDisplay } from "./config/teamNames";
import { logger } from "./logger";
import type { CalendarEventInput, T1Match } from "./types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국 표준시(UTC+9, 서머타임 없음) 고정 오프셋

/** Bo{n} 기준 경기 예상 소요 시간(분). 실제 종료 시각을 API가 주지 않아 추정치로 사용한다. */
const ESTIMATED_DURATION_MINUTES: Record<number, number> = {
  1: 45,
  3: 90,
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

/**
 * Apple Calendar 월간 보기/위젯/Apple Watch에서 잘리지 않도록 짧게 구성한다(15~20자 목표).
 * 이모지는 기기별 폰트/렌더링에 따라 자리를 많이 차지해 오히려 잘림을 유발하므로 넣지 않고,
 * 팀명(약어)과 스코어만 표시한다. 리그명과 시간도 SUMMARY에 넣지 않는다(시간은 캘린더가
 * 알아서 보여주고, 리그명은 DESCRIPTION에 넣는다).
 */
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

export function buildDescription(match: T1Match): string {
  const opponent = getTeamDisplay(match.opponent.code, match.opponent.name).full;
  const status = resolveStatus(match);

  const lines: string[] = [];
  lines.push(`🏆 ${match.competitionName}${match.blockName ? ` · ${match.blockName}` : ""}`);
  lines.push("");
  lines.push(`T1 vs ${opponent}`);
  lines.push("");
  lines.push(`Bo${match.bestOf}`);
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

  // 참고: Riot 공식 API는 경기 장소(오프라인 스튜디오 여부)와 패치 버전을 제공하지 않는다.
  // 값을 추측해서 채우는 대신 항목 자체를 생략한다.

  return lines.join("\n");
}

export function toCalendarEventInput(match: T1Match): CalendarEventInput {
  const durationMs = estimatedDurationMinutes(match.bestOf) * 60 * 1000;
  return {
    uid: match.uid,
    start: match.startTime,
    end: new Date(match.startTime.getTime() + durationMs),
    summary: buildSummary(match),
    description: buildDescription(match),
  };
}
