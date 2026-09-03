# 티카투카 (Ticatuka)

![티카투카 게임 화면](public/og.png)

실드와 알까기 규칙으로 상대와 겨루는 웹 기반 전략 주사위 미니게임입니다.

## 프로젝트 소개

이 프로젝트는 **Smilegate RPG의 MMORPG 《로스트아크》에 등장하는 미니게임 ‘티카투카’에서 영감을 받아 웹으로 구현해 본 비공식 팬 프로젝트**입니다.

《로스트아크》와 관련된 명칭, 원작 콘텐츠 및 상표의 권리는 각 권리자에게 있습니다. 이 프로젝트는 Smilegate RPG의 공식 프로젝트가 아니며, 학습 및 개인적인 포트폴리오 목적으로 제작되었습니다.

## 주요 기능

- 세 줄의 보드에 주사위를 배치하는 전략 게임
- 같은 숫자의 상대 주사위를 밀어내는 알까기 규칙과 애니메이션
- 제거되지 않는 실드 주사위
- 같은 숫자 조합에 따른 더블·트리플 점수 보너스
- 초급, 숙련, 전문가 난이도의 CPU 상대
- 초급 난이도의 줄별 예상 승률과 추천 위치 안내
- 게임 초기화, 리롤 및 게임 규칙 안내
- 반응형 화면 구성

## 로컬 실행

### 요구 사항

- Node.js 22.13.0 이상
- npm

### 개발 서버

```bash
git clone https://github.com/starzzangna/ticatuka.git
cd ticatuka
npm install
npm run dev
```

터미널에 표시되는 로컬 주소(일반적으로 `http://localhost:3000`)를 브라우저에서 열어주세요.

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 사용 가능한 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 생성 |
| `npm start` | 빌드된 앱 로컬 실행 |
| `npm run lint` | 코드 린트 검사 |
| `npm run format` | 코드 포맷 검사 및 정리 |

## 기술 스택

- React 19
- TypeScript
- Vinext / Vite
- Tailwind CSS
- Cloudflare Workers / Wrangler

## 라이선스 및 출처

본 저장소에는 별도의 오픈 소스 라이선스가 지정되어 있지 않습니다.

게임의 아이디어와 모티브: **《로스트아크》의 ‘티카투카’**  
원작: **Smilegate RPG**
