/**
 * T1 "1군" 경기만 남기기 위한 필터 규칙.
 *
 * 문자열을 코드 곳곳에 하드코딩하는 대신, 이 파일 하나에 규칙을 모아둔다.
 * 필터를 조정하고 싶으면 이 파일만 수정하면 된다.
 */

/** 1군 T1을 가리키는 팀 코드. Riot API의 team.code 값과 정확히 일치해야 한다. */
export const TARGET_TEAM_CODE = "T1";

/**
 * 팀 이름/코드/라운드명에 아래 패턴 중 하나라도 매칭되면 2군(아카데미/챌린저스) 등으로
 * 간주해 제외한다. 대소문자를 구분하지 않는다.
 *
 * 실제로는 COMPETITIONS 설정에서 LCK Challengers 같은 2군 리그 자체를 아예 수집 대상에
 * 넣지 않기 때문에 이 필터가 걸릴 일은 거의 없지만, 방어적으로 한 번 더 걸러낸다.
 */
export const EXCLUDE_PATTERNS: RegExp[] = [
  /academy/i,
  /challengers?/i,
  /\bCL\b/i,
  /amateur/i,
  /rookies?/i,
];

export function matchesExcludePattern(...values: string[]): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => values.some((value) => pattern.test(value)));
}

/** team.code가 1군 T1인지 판별한다. */
export function isTargetTeamCode(code: string): boolean {
  return code.trim().toUpperCase() === TARGET_TEAM_CODE;
}
