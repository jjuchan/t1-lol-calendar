import { logger } from "./logger";
import type { LolEsportsScheduleEvent, LolEsportsStandingsResponse, LolEsportsTournament } from "./types";

const API_BASE = "https://esports-api.lolesports.com/persisted/gw";

/**
 * lolesports.com 공식 웹사이트가 브라우저에서 그대로 호출하는 공개 API 키다.
 * 별도 로그인/발급 절차 없이 누구나 사용 가능하지만, Riot이 공식 문서화한 API는
 * 아니므로(비공식/비문서화) 예고 없이 바뀔 수 있다. 이 클라이언트의 실패는
 * index.ts에서 안전하게 흡수되어 기존 배포본을 깨뜨리지 않는다.
 */
const API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOnce<T>(path: string): Promise<T> {
  const url = `${API_BASE}/${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { "x-api-key": API_KEY },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** 일시적 오류에 대비해 재시도하는 공용 요청 함수. */
async function request<T>(path: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await requestOnce<T>(path);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`API 요청 실패 (${path}, 시도 ${attempt}/${MAX_ATTEMPTS}): ${message}`);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

interface GetScheduleResponse {
  data: {
    schedule: {
      events: LolEsportsScheduleEvent[];
      pages: { older?: string | null; newer?: string | null };
    };
  };
}

/** 주어진 leagueId의 경기 일정을 가져온다(최신 롤링 윈도우 한 페이지). */
export async function fetchSchedule(leagueId: string): Promise<LolEsportsScheduleEvent[]> {
  const body = await request<GetScheduleResponse>(`getSchedule?hl=en-US&leagueId=${encodeURIComponent(leagueId)}`);
  return body.data.schedule.events;
}

const MAX_SCHEDULE_PAGES = 8;

/**
 * 세트 득실 계산 등을 위해, 지정한 날짜(sinceIsoDate) 이후 경기가 전부 포함될 때까지
 * getSchedule의 이전 페이지(pages.older)를 따라가며 이벤트를 누적 수집한다.
 * 페이지 수에 상한(MAX_SCHEDULE_PAGES)을 둬서 API 응답이 이상하더라도 무한 루프에
 * 빠지지 않게 한다.
 */
export async function fetchScheduleSince(leagueId: string, sinceIsoDate: string): Promise<LolEsportsScheduleEvent[]> {
  const eventsByMatchId = new Map<string, LolEsportsScheduleEvent>();
  let path = `getSchedule?hl=en-US&leagueId=${encodeURIComponent(leagueId)}`;
  let oldestSeen = "9999-99-99";

  for (let page = 0; page < MAX_SCHEDULE_PAGES; page++) {
    const body = await request<GetScheduleResponse>(path);
    const { events, pages } = body.data.schedule;

    for (const event of events) {
      if (event.match) {
        eventsByMatchId.set(event.match.id, event);
      }
      if (event.startTime < oldestSeen) oldestSeen = event.startTime;
    }

    if (oldestSeen <= sinceIsoDate || !pages.older) break;
    path = `getSchedule?hl=en-US&leagueId=${encodeURIComponent(leagueId)}&pageToken=${encodeURIComponent(pages.older)}`;
  }

  return Array.from(eventsByMatchId.values());
}

interface GetTournamentsResponse {
  data: {
    leagues: { tournaments: LolEsportsTournament[] }[];
  };
}

/** 해당 리그의 전체 토너먼트(스플릿/시즌) 목록을 가져온다. */
export async function fetchTournamentsForLeague(leagueId: string): Promise<LolEsportsTournament[]> {
  const body = await request<GetTournamentsResponse>(
    `getTournamentsForLeague?hl=en-US&leagueId=${encodeURIComponent(leagueId)}`
  );
  return body.data.leagues[0]?.tournaments ?? [];
}

/** 특정 토너먼트의 순위표(스탠딩)를 가져온다. */
export async function fetchStandings(tournamentId: string): Promise<LolEsportsStandingsResponse> {
  return request<LolEsportsStandingsResponse>(
    `getStandingsV3?hl=en-US&tournamentId=${encodeURIComponent(tournamentId)}`
  );
}
