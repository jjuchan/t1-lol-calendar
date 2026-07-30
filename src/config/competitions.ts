/**
 * 수집 대상 대회 목록.
 *
 * leagueId는 Riot 공식 LoL Esports API(esports-api.lolesports.com)의 getLeagues 응답에서
 * 확인한 값이다. 새로운 대회를 추가하려면 이 배열에 항목을 하나 추가하기만 하면 된다.
 *
 * 참고: "LCK Cup"은 별도 leagueId가 아니라 'lck' 리그 피드 안에 하나의 하위 토너먼트
 * (예: LCK Split 1/2/3, LCK Cup 등)로 포함되어 함께 내려온다. 즉 아래 'lck' 항목만으로
 * LCK 정규 시즌과 LCK Cup(또는 그 해의 스플릿/컵 명칭이 무엇이든)이 모두 커버된다.
 */
export interface CompetitionConfig {
  /** 내부 식별자. UID 생성 등에는 사용하지 않고 로그 표시용으로만 쓴다. */
  id: string;
  /** 사람이 읽는 대회명. DESCRIPTION에 그대로 노출된다. */
  name: string;
  /** Riot LoL Esports API의 리그 ID. */
  leagueId: string;
  /** false로 두면 이 대회는 수집에서 제외된다. */
  enabled: boolean;
}

export const COMPETITIONS: CompetitionConfig[] = [
  { id: "lck", name: "LCK", leagueId: "98767991310872058", enabled: true },
  { id: "msi", name: "MSI", leagueId: "98767991325878492", enabled: true },
  { id: "worlds", name: "Worlds", leagueId: "98767975604431411", enabled: true },
  { id: "ewc", name: "EWC", leagueId: "116838530616006090", enabled: true },
  { id: "first_stand", name: "First Stand", leagueId: "113464388705111224", enabled: true },
  { id: "kespa_cup", name: "KeSPA Cup", leagueId: "116929044967296666", enabled: true },
  // 새 대회를 추가하려면 아래처럼 한 줄만 추가하면 된다. (leagueId는
  // https://esports-api.lolesports.com/persisted/gw/getLeagues?hl=en-US 응답에서 조회)
  // { id: "rift_rivals", name: "Rift Rivals", leagueId: "...", enabled: true },
];
