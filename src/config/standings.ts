/**
 * 세트 득실 계산 시 "정규시즌" 라운드로 인정할 blockName 패턴.
 *
 * Riot API의 경기 일정에는 정규시즌(Week N)과 플레이오프(Knockouts 등)가 같은 리그
 * 피드에 섞여 나온다. 순위표의 record(승/패)는 플레이오프를 제외한 정규시즌 성적만
 * 반영하므로, 세트 득실도 같은 기준으로 맞추기 위해 이 패턴에 맞는 라운드만 집계한다.
 *
 * 대회 포맷이 바뀌어 라운드 이름이 달라지면 이 정규식만 수정하면 된다.
 */
export const REGULAR_SEASON_BLOCK_PATTERN = /^Week \d+$/;

/** 순위표 계산에 쓸 표준 승/패(스탠딩) section 타입. bracket(토너먼트 대진표)은 제외된다. */
export const STANDINGS_GROUP_SECTION_TYPES = new Set(["group", "crossGroup"]);
