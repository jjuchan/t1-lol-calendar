export interface CompetitionConfig {
  id: string;
  name: string;
  leagueId: string;
  enabled: boolean;
  showStandings: boolean;
}

export const COMPETITIONS: CompetitionConfig[] = [
  { id: "lck", name: "LCK", leagueId: "98767991310872058", enabled: true, showStandings: true },
  { id: "msi", name: "MSI", leagueId: "98767991325878492", enabled: true, showStandings: false },
  { id: "worlds", name: "Worlds", leagueId: "98767975604431411", enabled: true, showStandings: false },
  { id: "ewc", name: "EWC", leagueId: "116838530616006090", enabled: true, showStandings: false },
  { id: "first_stand", name: "First Stand", leagueId: "113464388705111224", enabled: true, showStandings: false },
  { id: "kespa_cup", name: "KeSPA Cup", leagueId: "116929044967296666", enabled: true, showStandings: false },
];
