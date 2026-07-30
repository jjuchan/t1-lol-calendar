import { logger } from "./logger";
import type { LolEsportsScheduleEvent } from "./types";

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

interface GetScheduleResponse {
  data: {
    schedule: {
      events: LolEsportsScheduleEvent[];
    };
  };
}

async function fetchOnce(leagueId: string): Promise<LolEsportsScheduleEvent[]> {
  const url = `${API_BASE}/getSchedule?hl=en-US&leagueId=${encodeURIComponent(leagueId)}`;
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

    const body = (await response.json()) as GetScheduleResponse;
    return body.data.schedule.events;
  } finally {
    clearTimeout(timeout);
  }
}

/** 주어진 leagueId의 경기 일정을 가져온다. 일시적 오류에 대비해 재시도한다. */
export async function fetchSchedule(leagueId: string): Promise<LolEsportsScheduleEvent[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchOnce(leagueId);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`getSchedule 실패 (leagueId=${leagueId}, 시도 ${attempt}/${MAX_ATTEMPTS}): ${message}`);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
