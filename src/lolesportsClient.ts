import { logger } from "./logger";
import type { LolEsportsScheduleEvent, LolEsportsStandingsResponse, LolEsportsTournament } from "./types";

const API_BASE = "https://esports-api.lolesports.com/persisted/gw";

// lolesports 비공식 API 키. lolesports.com 프론트엔드에 박혀 있는 공개 상수라
// 비밀은 아니지만, 소스에서 분리해 환경변수로 주입한다. 로컬은 .env(.env.example 참고),
// CI는 GitHub Actions Variable(LOLESPORTS_API_KEY)로 전달.
const apiKeyFromEnv = process.env.LOLESPORTS_API_KEY;

if (!apiKeyFromEnv) {
  throw new Error(
    "환경변수 LOLESPORTS_API_KEY 가 설정되지 않았습니다. .env.example 을 복사해 .env 를 만들거나 환경변수를 주입하세요."
  );
}

const API_KEY: string = apiKeyFromEnv;

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 2_000;
const RETRY_JITTER_MS = 1_000;

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
        const jitter = Math.random() * RETRY_JITTER_MS;
        await sleep(RETRY_BASE_DELAY_MS * attempt + jitter);
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

export async function fetchSchedule(leagueId: string): Promise<LolEsportsScheduleEvent[]> {
  const body = await request<GetScheduleResponse>(`getSchedule?hl=en-US&leagueId=${encodeURIComponent(leagueId)}`);
  return body.data.schedule.events;
}

const MAX_SCHEDULE_PAGES = 8;

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

export async function fetchTournamentsForLeague(leagueId: string): Promise<LolEsportsTournament[]> {
  const body = await request<GetTournamentsResponse>(
    `getTournamentsForLeague?hl=en-US&leagueId=${encodeURIComponent(leagueId)}`
  );
  return body.data.leagues[0]?.tournaments ?? [];
}

export async function fetchStandings(tournamentId: string): Promise<LolEsportsStandingsResponse> {
  return request<LolEsportsStandingsResponse>(
    `getStandingsV3?hl=en-US&tournamentId=${encodeURIComponent(tournamentId)}`
  );
}
