/**
 * 팀 코드 -> 표시용 이름 매핑.
 *
 * Riot 공식 API는 이미 짧은 팀 코드(code 필드, 예: "T1", "GEN")를 내려주므로 기본적으로는
 * 이 매핑이 없어도 동작한다. 다만 스폰서 개편 등으로 팀명이 자주 바뀌기 때문에, 화면에
 * 노출할 "정식 이름"(DESCRIPTION용)과 "약어"(SUMMARY용)를 이 파일 하나에서 관리한다.
 *
 * 팀명이 바뀌면 이 객체만 수정하면 된다. 매핑에 없는 코드는 API가 내려준 원본 code/name을
 * 그대로 사용하므로(아래 getTeamDisplay 참고), 매핑을 깜빡 업데이트하지 않아도 파이프라인이
 * 깨지지는 않는다.
 */
export interface TeamDisplay {
  /** SUMMARY(제목)에 쓰이는 짧은 약어. 2~4자 목표. */
  short: string;
  /** DESCRIPTION(상세 설명)에 쓰이는 정식 팀명. */
  full: string;
}

export const TEAM_DISPLAY_OVERRIDES: Record<string, TeamDisplay> = {
  T1: { short: "T1", full: "T1" },
  GEN: { short: "GEN", full: "Gen.G" },
  HLE: { short: "HLE", full: "Hanwha Life Esports" },
  DK: { short: "DK", full: "Dplus KIA" },
  KT: { short: "KT", full: "KT Rolster" },
  DRX: { short: "DRX", full: "DRX" },
  NS: { short: "NS", full: "Nongshim RedForce" },
  BFX: { short: "BFX", full: "BNK FEARX" },
  BRO: { short: "BRO", full: "OKSavingsBank BRION" },
  DNF: { short: "DNF", full: "DN Freecs" },
};

/** 아직 대진이 확정되지 않은 상대팀을 가리키는 API의 placeholder 코드. */
export const TBD_CODE = "TBD";

export function getTeamDisplay(apiCode: string, apiName: string): TeamDisplay {
  const override = TEAM_DISPLAY_OVERRIDES[apiCode];
  if (override) return override;
  if (apiCode === TBD_CODE) return { short: "TBD", full: "TBD" };
  // 매핑에 없는(=아직 등록하지 않은) 팀은 API 원본 값을 그대로 사용한다.
  return { short: apiCode, full: apiName };
}
