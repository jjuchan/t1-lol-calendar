import type { CompetitionConfig } from "./config/competitions";

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
    count: number;
  };
}

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

export interface LolEsportsTournament {
  id: string;
  slug: string;
  startDate: string;
  endDate: string;
}

interface LolEsportsStandingsTeam {
  code: string;
  name: string;
  record?: { wins: number; losses: number; ties: number };
}

interface LolEsportsStandingsRanking {
  ordinal: number;
  teams: LolEsportsStandingsTeam[];
}

interface LolEsportsStandingsSection {
  name: string;
  type: string;
  rankings?: LolEsportsStandingsRanking[];
}

interface LolEsportsStandingsStage {
  name: string;
  sections: LolEsportsStandingsSection[];
}

export interface LolEsportsStandingsResponse {
  data: {
    standings: {
      stages: LolEsportsStandingsStage[];
    }[];
  };
}

export interface StandingsRow {
  rank: number;
  code: string;
  wins: number;
  losses: number;
  setWins: number;
  setLosses: number;
}

export interface GroupStandings {
  groupName: string | null;
  rows: StandingsRow[];
}

export interface ScheduleEventWithCompetition extends LolEsportsScheduleEvent {
  competition: CompetitionConfig;
}

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
