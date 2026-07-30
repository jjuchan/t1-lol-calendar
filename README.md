# T1 LoL Esports 캘린더

T1의 1군 경기(LCK, MSI, Worlds, EWC, First Stand, KeSPA Cup)만 모아서 iCalendar(.ics) 파일로
만들어주는 프로젝트입니다. Apple Calendar에서 한 번만 "구독"해두면 이후 일정이 자동으로
갱신됩니다.

- 제목(SUMMARY)은 Apple Calendar 월간 보기 / 잠금화면 위젯 / Apple Watch에서도 잘리지 않도록
  최대한 짧게(`🆚 T1-GEN`, `✅ T1 2:1 GEN`) 구성됩니다.
- 상세 정보(DESCRIPTION)에는 리그/라운드, 매치업, Bo 방식, 킥오프 시간(KST), 결과(종료 후),
  중계 링크가 담깁니다.
- 경기가 끝나면 **같은 이벤트(UID)를 그대로 유지한 채** SUMMARY/DESCRIPTION만 스코어로
  갱신됩니다. 즉 Apple Calendar에서는 새 이벤트가 생기는 게 아니라 기존 일정이 업데이트된
  것처럼 보입니다.

## 데이터 소스에 대해 (중요)

요구사항 초안에는 `lol-events`(zlypher) 프로젝트의 ICS를 쓰는 것으로 되어 있었지만, 실제로
조사해보니 다음 문제가 있어 **Riot 공식 LoL Esports API**(`esports-api.lolesports.com`)로
전환했습니다.

- `lol-events`의 ICS는 `UID`/`DTSTART`/`DTEND`/`SUMMARY`만 있고 장소·설명·스코어 정보가 없음
- EWC(Esports World Cup), First Stand 피드가 아예 존재하지 않음
- 경기 스코어 정보가 전혀 없어 "종료 후 스코어 자동 반영"을 구현할 수 없음

Riot 공식 API는 lolesports.com 웹사이트 자체가 브라우저에서 호출하는 API로, 별도 가입/과금
없이 누구나 쓸 수 있는 공개 키를 사용합니다(`src/lolesportsClient.ts` 참고). 다만 공식 문서가
있는 API는 아니므로 Riot이 예고 없이 구조를 바꿀 가능성은 있습니다. 이 프로젝트는 API 호출이
전부 실패해도 **직전에 배포된 t1.ics를 그대로 유지**하도록 만들어져 있어(아래 "장애 대응"
참고), 그런 경우에도 캘린더가 깨지지 않습니다.

또한 이 API는 경기 **장소(오프라인 스튜디오)** 와 **패치 버전**을 제공하지 않습니다. 값을
추측해서 채우기보다는 해당 항목 자체를 DESCRIPTION에서 생략했습니다.

## 프로젝트 구조

```
src/
  config/
    competitions.ts   # 수집 대상 대회 목록 (leagueId 기반) - 여기에 추가/삭제
    teamNames.ts       # 팀 코드 -> 표시 이름(약어/정식명) 매핑
    filter.ts           # T1 판별 기준 + 2군/아카데미 제외 규칙
    retention.ts        # 종료된 경기를 며칠까지 보관할지
  types.ts               # 공용 타입 정의
  lolesportsClient.ts     # Riot LoL Esports API 호출 (재시도 포함)
  fetch.ts                # 대회별 일정 병렬 수집
  filter.ts                # T1 1군 경기만 필터링 + 정규화
  format.ts                 # SUMMARY/DESCRIPTION 문구 생성
  merge.ts                   # 기존 t1.ics와 병합 (UID 기준 갱신 + 보관기간 정리)
  generate.ts                 # ical-generator로 최종 ICS 문자열 생성
  logger.ts                    # 타임스탬프 포함 로거
  index.ts                      # 전체 파이프라인 실행 (fetch -> filter -> format -> merge -> write)

.github/workflows/update.yml   # 스케줄/수동 실행 + GitHub Pages 배포
public/t1.ics                   # 생성된 결과물 (구독 대상 파일)
```

## 설치

```bash
npm install
```

Node.js 20 이상이 필요합니다.

## 실행

```bash
# 1회 실행 (컴파일 후 실행)
npm run build
npm run generate

# 개발 중 빠르게 실행 (컴파일 없이 tsx로 바로 실행)
npm run dev

# 타입만 검사
npm run typecheck
```

실행하면 `public/t1.ics`가 생성/갱신됩니다. 최초 실행 시에는 파일이 없으므로 전부 새로
생성되고, 이후 실행부터는 기존 파일과 병합됩니다.

### 과거 경기 보관 정책

`src/config/retention.ts`의 `PAST_MATCH_RETENTION_DAYS`(기본값 7)를 기준으로, 종료된 지
그보다 오래된 경기는 자동으로 t1.ics에서 제거됩니다. 예정된 경기는 기간과 무관하게 항상
유지됩니다. 값을 바꾸고 싶으면 이 숫자만 수정하세요.

### 장애 대응

- 특정 대회 하나가 API 호출에 실패해도 나머지 대회로 계속 진행합니다(로그에 경고만 남김).
- **모든** 대회 호출이 실패하면 프로세스가 0이 아닌 코드로 종료됩니다. GitHub Actions에서는
  이 경우 이후 "커밋/배포" 단계가 실행되지 않으므로, 직전에 배포된 GitHub Pages의 t1.ics가
  그대로 유지됩니다.

## GitHub Pages 배포

1. 이 프로젝트를 GitHub 저장소에 푸시합니다.
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **"GitHub Actions"**로
   설정합니다. (브랜치/폴더 방식이 아닙니다.)
3. `.github/workflows/update.yml`이 다음을 자동으로 수행합니다.
   - 3시간마다(하루 8회, `cron: "0 */3 * * *"`) 자동 실행 + `workflow_dispatch`로 수동 실행 가능
   - 최신 일정을 가져와 `public/t1.ics` 재생성
   - 변경분을 저장소에 커밋(과거 이력을 git으로도 추적 가능)
   - GitHub Pages에 `public/` 폴더를 배포

배포가 끝나면 아래 형태의 URL에서 파일을 받을 수 있습니다.

```
https://<github-username>.github.io/<repository-name>/t1.ics
```

Actions 탭에서 워크플로우를 한 번 수동 실행(`Run workflow`)해서 첫 배포를 트리거하세요.

## Apple Calendar 구독 방법

1. 아이폰 **설정 → 캘린더 → 계정 → 계정 추가 → 기타 → 구독 캘린더 추가**로 이동합니다.
2. 서버 주소에 위의 `https://<github-username>.github.io/<repository-name>/t1.ics` 를
   입력합니다.
3. 저장하면 완료입니다. 이후 GitHub Actions가 원본을 갱신할 때마다 iOS가 주기적으로(보통
   몇 시간 단위) 자동으로 다시 불러옵니다. 즉시 반영하고 싶다면 캘린더 앱을 당겨서 새로고침하면
   됩니다.

macOS Calendar.app에서도 **파일 → 새로운 캘린더 구독**으로 동일하게 등록할 수 있습니다.

## 새로운 대회 추가 방법

1. https://esports-api.lolesports.com/persisted/gw/getLeagues?hl=en-US 를 열어 원하는 대회의
   `id`(leagueId)를 찾습니다.
2. `src/config/competitions.ts`의 `COMPETITIONS` 배열에 한 줄 추가합니다.

```ts
{ id: "rift_rivals", name: "Rift Rivals", leagueId: "1234567890", enabled: true },
```

그 대회에서 열리는 T1 경기가 다음 실행부터 자동으로 포함됩니다. 참고로 "LCK Cup"처럼 한
리그 안에 여러 하위 토너먼트(스플릿/컵)가 있는 경우는 별도 항목을 추가할 필요 없이 해당 리그
하나(`lck`)만으로 전부 커버됩니다.

## 필터 수정 방법

- **어떤 팀을 "T1 1군"으로 볼지**: `src/config/filter.ts`의 `TARGET_TEAM_CODE`
  (기본값 `"T1"`, Riot API의 team.code 값과 정확히 일치해야 함)
- **2군/아카데미 등 제외 규칙**: 같은 파일의 `EXCLUDE_PATTERNS` 배열에 정규식을 추가/삭제
- **팀 표시 이름(약어/정식명)**: `src/config/teamNames.ts`의 `TEAM_DISPLAY_OVERRIDES`. 팀
  스폰서명이 바뀌면 이 객체만 수정하면 됩니다. 매핑에 없는 팀은 API가 내려주는 원본 코드/이름을
  그대로 사용하므로 업데이트를 깜빡해도 파이프라인이 깨지지 않습니다.

## 기술 스택

- Node.js 20+ / TypeScript(strict 모드) / npm
- [`ical-generator`](https://www.npmjs.com/package/ical-generator) — ICS 생성
- [`node-ical`](https://www.npmjs.com/package/node-ical) — 기존 t1.ics 파싱(병합용)
- GitHub Actions — 스케줄 실행 + GitHub Pages 배포
