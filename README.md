# T1 LoL Esports 캘린더

T1 1군 경기(LCK, MSI, Worlds, EWC, First Stand, KeSPA Cup)만 모은 구독형 ICS 캘린더.

<img src="docs/screenshot.jpg" alt="Apple Calendar 구독 화면" width="360" />

## 설치 / 실행

```bash
npm install
cp .env.example .env   # lolesports API 키 (공개 상수)
npm run build
npm run generate       # public/t1.ics 생성/갱신
```

- `npm run dev` : 컴파일 없이 바로 실행
- `npm run typecheck` : 타입 검사만

## 자동 갱신

`.github/workflows/update.yml`이 30분마다 자동 실행되어 `public/t1.ics`를 갱신하고
GitHub Pages(Settings → Pages → Source: GitHub Actions)에 배포한다. Actions 탭에서
`Run workflow`로 수동 실행도 가능.

API 키는 저장소 Variable `LOLESPORTS_API_KEY`(Settings → Secrets and variables →
Actions → Variables)로 주입한다. 비밀이 아닌 공개 상수라 Secret이 아닌 Variable.

## 설정 파일

- `src/config/competitions.ts` — 수집 대상 대회(leagueId) 추가/삭제
- `src/config/filter.ts` — T1 판별 기준(`TARGET_TEAM_CODE`) / 2군·아카데미 제외 규칙
- `src/config/teamNames.ts` — 팀 코드 -> 표시 이름 매핑 (스폰서명 바뀌면 여기만 수정)

과거 경기는 제거하지 않고 `t1.ics`에 계속 보존한다.

## 참고

데이터 소스는 요구사항의 `lol-events` 대신 Riot 공식 LoL Esports API
(`esports-api.lolesports.com`)를 쓴다 — lol-events는 EWC/First Stand 피드가 없고
스코어 정보도 없어서. 경기 장소/패치 버전은 이 API가 제공하지 않아 DESCRIPTION에서 생략.
