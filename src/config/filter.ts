export const TARGET_TEAM_CODE = "T1";

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

export function isTargetTeamCode(code: string): boolean {
  return code.trim().toUpperCase() === TARGET_TEAM_CODE;
}
