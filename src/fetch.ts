import { COMPETITIONS, type CompetitionConfig } from "./config/competitions";
import { fetchSchedule } from "./lolesportsClient";
import { logger } from "./logger";
import type { FetchFailure, FetchResult, ScheduleEventWithCompetition } from "./types";

export async function fetchAllMatches(
  competitions: CompetitionConfig[] = COMPETITIONS.filter((c) => c.enabled)
): Promise<FetchResult> {
  const events: ScheduleEventWithCompetition[] = [];
  const failures: FetchFailure[] = [];

  const results = await Promise.allSettled(
    competitions.map(async (competition) => {
      const rawEvents = await fetchSchedule(competition.leagueId);
      return { competition, rawEvents };
    })
  );

  results.forEach((result, index) => {
    const competition = competitions[index];
    if (!competition) return;

    if (result.status === "fulfilled") {
      const { rawEvents } = result.value;
      logger.info(`${competition.name}: ${rawEvents.length}개 이벤트 수신`);
      for (const event of rawEvents) {
        events.push({ ...event, competition });
      }
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      logger.error(`${competition.name} 일정 수집 실패: ${message}`);
      failures.push({ competitionId: competition.id, competitionName: competition.name, error: message });
    }
  });

  return { events, failures };
}
