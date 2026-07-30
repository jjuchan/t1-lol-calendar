import type { CompetitionConfig } from "./config/competitions";

/** Riot LoL Esports API의 getSchedule 응답 중 팀 한 명(팀) 항목. */
export interface LolEsportsTeam {
  name: string;
  code: string;
  result?: {
    outcome: "win" | "loss" | null;
    gameWins: number;
  };
}

export interface LolEsportsMatch {
  id: string;
  teams: LolEsportsTeam[];
  strategy?: {
    type: string;
    /** Bo1/Bo3/Bo5 등의 "3", "5" 값. */
    count: number;
  };
}

/** API가 내려줄 수 있는 상태값. 향후 신규 상태가 추가돼도 깨지지 않도록 string도 허용한다. */
export type ScheduleEventState = "unstarted" | "inProgress" | "completed" | (string & {});

export interface LolEsportsScheduleEvent {
  startTime: string;
  state: ScheduleEventState;
  type: string;
  blockName?: string;
  league: {
    name: string;
    slug: string;
  };
  match?: LolEsportsMatch;
}

/** 어느 대회 설정에서 가져온 이벤트인지 태깅한 원본 이벤트. */
export interface ScheduleEventWithCompetition extends LolEsportsScheduleEvent {
  competition: CompetitionConfig;
}

/** 필터링 + 정규화를 마친, T1이 참여하는 경기 하나. */
export interface T1Match {
  uid: string;
  matchId: string;
  competitionId: string;
  competitionName: string;
  leagueId: string;
  blockName: string | undefined;
  startTime: Date;
  state: ScheduleEventState;
  bestOf: number;
  t1: { code: string; name: string };
  opponent: { code: string; name: string };
  t1Score: number;
  opponentScore: number;
  outcome: "win" | "loss" | null;
}

/** 최종적으로 ICS VEVENT 하나를 생성하기 위한 입력값. */
export interface CalendarEventInput {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
}

export interface FetchFailure {
  competitionId: string;
  competitionName: string;
  error: string;
}

export interface FetchResult {
  events: ScheduleEventWithCompetition[];
  failures: FetchFailure[];
}
