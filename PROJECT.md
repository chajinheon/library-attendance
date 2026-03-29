# 효명고등학교 야간자율학습 출결 시스템

> **개발자**: 차진헌 (24293@hmh.or.kr)
> **상태**: 정식 운영 중 (2026-03-30 ~)
> **배포**: Vercel (GitHub main 브랜치 자동 배포)
> **Firebase 프로젝트**: `studio-7637122488-1dc59`
> **Firebase 도메인**: `studio-7637122488-1dc59.web.app` / `studio-7637122488-1dc59.firebaseapp.com`

---

## 프로젝트 개요

효명고등학교 도서관에 갤럭시 탭으로 배치된 **야간자율학습 출석 체크 키오스크 시스템**

- **학생**: 학번(5자리) 키패드 직접 입력 또는 학생증 바코드 스캔으로 출석 처리
- **교사(관리자)**: `/admin` 에서 출석 현황 확인, 학생 등록/삭제, 통계 확인, 엑셀 내보내기
- **운영 형태**: 갤럭시 탭에 PWA 설치 → 삼성 앱 고정 모드로 키오스크화

---

## 기술 스택

| 항목 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | ^16.2.1 |
| 언어 | TypeScript | ^5 |
| 런타임 | React | ^19.0.0 |
| 스타일 | Tailwind CSS + tailwindcss-animate | ^3.4.17 |
| UI 컴포넌트 | shadcn/ui (Radix UI 기반) | - |
| DB | Firebase Firestore (실시간 구독) | ^11.4.0 |
| 인증 | Firebase Auth (익명 로그인) | ^11.4.0 |
| AI | Genkit + @genkit-ai/googleai (Gemini) | ^1.8.0 |
| 바코드 스캔 | html5-qrcode (카메라 기반) | ^2.3.8 |
| 날짜 처리 | date-fns | ^3.6.0 |
| 아이콘 | lucide-react | ^0.474.0 |
| 엑셀 내보내기 | xlsx | ^0.18.5 |
| 외부 연동 | Notion API | 현재 비활성 |

---

## 디렉토리 구조

```
app/
├── page.tsx                  # 메인 출석 체크 화면 (키패드 + 바코드 스캐너)
├── layout.tsx                # 루트 레이아웃 (PWA 설정, HTTPS 강제, SW 등록)
├── globals.css               # 전역 스타일 (Tailwind 커스텀 클래스 포함)
├── admin/
│   └── page.tsx              # 관리자 페이지 (2303줄, 9개 탭)
├── guide/
│   └── page.tsx              # 사용 가이드 페이지
├── actions/
│   └── sync-notion.ts        # Notion 동기화 Server Action (현재 비활성 - stub)
└── api/
    ├── ai/
    │   └── summarize/
    │       └── route.ts      # AI 출석 요약 API (Gemini 연동, 현재 미사용)
    └── backup/
        └── route.ts          # 백업 API 라우트

components/
├── KioskGuard.tsx            # 키오스크 보안 레이어 (단축키 차단, 전체화면 감지)
├── AttendanceRoster.tsx      # 실시간 출석 현황 목록 (메인 화면 우측)
└── ui/                       # shadcn/ui 컴포넌트
    ├── button.tsx
    ├── card.tsx
    ├── toast.tsx
    └── toaster.tsx

firebase/
├── config.ts                 # Firebase 초기화 (initializeApp, getFirestore, getAuth)
├── client-provider.tsx       # FirebaseClientProvider (익명 로그인 + Context 제공)
└── index.ts                  # useFirestore, useCollection, useMemoFirebase 훅

hooks/
└── use-toast.ts              # Toast 상태 관리 훅

lib/
├── types.ts                  # Student, AttendanceEntry, BarcodeMapping, CardScan 타입
├── barcode-utils.ts          # normalizeBarcodeValue, isValidBarcode 함수
├── daily-backup.ts           # dailyBackupToNotion (현재 비활성 - stub)
└── utils.ts                  # cn() (clsx + tailwind-merge) 유틸

public/
├── manifest.json             # PWA 매니페스트 (display: standalone)
├── sw.js                     # Service Worker (외부 URL 차단, Firebase 허용)
└── icons/
    ├── icon.svg              # PWA 기본 아이콘
    └── icon-maskable.svg     # PWA 마스커블 아이콘

next.config.ts                # 보안 헤더, CORS, ServerActions 허용 출처
tailwind.config.ts            # Tailwind 테마 (HSL 색상 변수, 애니메이션)
tsconfig.json                 # TypeScript 설정
package.json                  # 의존성 관리
.env.local                    # Firebase/Notion API 키 (절대 커밋 금지)
```

---

## Firebase Firestore 컬렉션 구조

| 컬렉션 | 문서 ID 규칙 | 주요 필드 |
|--------|-------------|-----------|
| `students` | `{studentId}` (5자리 학번) | name, grade, classNum, number, studentId |
| `attendance_logs` | `{studentId}_{date}` | studentId, studentName, date(yyyy-MM-dd), grade, timestamp, type('scan'\|'keypad') |
| `card_scans` | `{studentId}_{date}` | rawCode, studentId, studentName, date, monthKey(yyyy-MM), grade, point |
| `barcode_mappings` | `{normalizedBarcode}` | studentId |

**중복 출석 방지**: 문서 ID를 `{studentId}_{date}` 복합키로 설정
→ 같은 날 동일 학생의 문서는 Firestore에서 1개만 존재 가능 (자동 덮어쓰기 방지)

---

## 타입 정의 (`lib/types.ts`)

```typescript
interface Student {
  id: string;
  studentId: string;    // 5자리 학번 (예: 30228 → 3학년 2반 28번)
  name: string;
  grade: number;        // 1, 2, 3
  classNum: number;
  number: number;
}

interface AttendanceEntry {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: Timestamp; // Firebase Timestamp
  date: string;         // yyyy-MM-dd
  grade: number;
  type: 'scan' | 'keypad';
}

interface CardScan {
  id: string;
  rawCode: string;
  studentId: string;
  studentName: string;
  timestamp: Timestamp;
  date: string;
  monthKey: string;     // yyyy-MM (랭킹 집계용)
  grade: number;
  point: number;        // 출석 포인트 (기본 1)
}

interface BarcodeMapping {
  id: string;
  barcode: string;      // 정규화된 바코드 값
  studentId: string;
}
```

---

## 핵심 로직 상세

### 출석 처리 흐름 (`processCheckIn` in `app/page.tsx`)

```
바코드 스캔 또는 학번 5자리 입력
        ↓
[바코드인 경우] normalizeBarcodeValue(raw)
  → trim + 대문자 변환 + 특수문자 제거
  → barcode_mappings/{normalizedCode} 조회 → studentId 획득
        ↓
[키패드인 경우] input.trim() = studentId 직접 사용
        ↓
students/{studentId} 조회
  ├─ 문서 없음 → 800ms 대기 후 재시도 1회
  └─ 여전히 없음 → "등록되지 않은 학번" 오류
        ↓
attendance_logs/{studentId}_{today} 존재 여부 확인
  └─ 이미 있음 → "이미 출석 처리됨" 경고 + 이름 표시
        ↓
writeBatch 동시 저장:
  ├─ attendance_logs/{studentId}_{today} 생성
  └─ card_scans/{studentId}_{today} 생성
        ↓
syncToNotion()      (현재 비활성 stub)
dailyBackupToNotion() (현재 비활성 stub)
        ↓
3초간 체크인 완료 오버레이 표시 (이름, 학년, 반, 번호)
2.5초 후 입력란 초기화
```

### 비활성 자동 초기화 (타이머)

| 모드 | 타이머 | 동작 |
|------|--------|------|
| 키패드 모드 | 30초 무입력 | 입력란(`input`) 자동 초기화 |
| 스캔 모드 | 30초 스캔 없음 | 자동으로 키패드 모드 복귀 |

- 입력/스캔 감지 시 타이머 리셋 (연속 사용 중 꺼지지 않음)
- `idleTimerRef`, `scannerIdleTimerRef`로 각각 관리

### 바코드 스캐너 (`html5-qrcode`)

```typescript
html5QrCode.start(
  { facingMode: "user" },           // 전면 카메라
  { fps: 10, qrbox: { width: 400, height: 150 } },
  (decoded) => processCheckIn(decoded, true),
  ...
);
```

- 카메라 권한 오류 시 사용자에게 안내
- 스캔 모드 종료 시 `html5QrCode.stop()` 호출하여 카메라 해제

---

## 관리자 페이지 (`/admin`) - 9개 탭

### 인증 방식

| 항목 | 세부 내용 |
|------|----------|
| 비밀번호 저장 | `localStorage` → `sha256:{hex}` 형식으로 SHA-256 해시 저장 |
| 해시 구성 | `crypto.subtle.digest('SHA-256', encoder.encode(password + 'hm_admin_2025'))` |
| 기본 비밀번호 | `admin1234` (반드시 변경 권장) |
| 마스터 키 | `@@@@` (비상 접근용) |
| 이전 버전 호환 | XOR 난독화 → SHA-256 자동 마이그레이션 |
| 로그인 제한 | 10회 실패 시 1분 잠금 (`localStorage` 저장) |
| 세션 타임아웃 | 15분 비활성 시 자동 로그아웃 (`sessionStorage` 저장) |
| 비밀 트리거 | 비밀번호 변경란에 `1105` 입력 → Secret Stats 오버레이 표시 |

### 탭 구성 및 기능

#### 1. `attendance` - 당일 출석 현황
- 통계 카드: 전체 학생 수, 출석/미출석 수, 출석률(%)
- 학년별 분류 (1/2/3학년)
- 스캔 vs 키패드 입력 비율 표시

#### 2. `students` - 학생 관리
- 학생 목록 (검색 + 학년 필터)
- 학생 추가: 이름, 학번(5자리), 학년, 반, 번호
- 학생 삭제
- **학년 전환 기능** (진급/졸업 처리):
  - 3학년 → 전원 삭제
  - 1/2학년 → `grade + 1` 업데이트
  - `writeBatch`로 일괄 처리

#### 3. `history` - 출석 이력
- 특정 날짜의 출석 기록 조회 (`historyDate` 필터)
- `attendance_logs` 컬렉션에서 `date` 필드로 필터링

#### 4. `barcode` - 바코드 매핑 관리
- 바코드 값 ↔ 학번(studentId) 매핑 CRUD
- `barcode_mappings` 컬렉션 관리

#### 5. `ranking` - 월별 출석 랭킹
- `card_scans` 컬렉션에서 `monthKey` 필터링
- 학생별 `point` 합산 → 내림차순 정렬
- 학년 필터 지원
- `useMemo`로 집계 최적화

#### 6. `settings` - 설정
- 비밀번호 변경 (최소 4자)
- 전체 출석 CSV 다운로드

#### 7. `export` - 엑셀 내보내기
- 기간 선택 (시작일 ~ 종료일)
- 빠른 범위: 이번 달, 지난 달, 최근 7일, 최근 30일
- 학년 선택 (복수 선택 가능)
- `xlsx` 라이브러리로 `.xlsx` 파일 생성
- 반별 시트로 분류하여 내보내기

#### 8. `guide` - 사용 가이드
- 시스템 사용법 안내

#### 9. `contact` - 문의
- 개발자 연락처

### Secret Stats (숨겨진 관리 기능)
- 비밀번호 변경란에 `1105` 입력 시 접근
- 기간별 통계 조회 (30일, 90일, 전체)
- 오늘 출석 초기화
- 전체 출석 데이터 초기화 (2단계 확인 필요)
- 배치 삭제 (400개 단위로 청크 처리)

---

## 보안 구조 (2026-03-28 강화)

### 1단계 - PWA (주소창 제거)

- `manifest.json`: `"display": "standalone"` → 브라우저 UI 완전 제거
- `layout.tsx`: Service Worker 등록, HTTPS 강제 리다이렉트
- 뷰포트: `user-scalable=no` → 핀치 줌 방지
- 설치: 크롬/삼성 인터넷 → 홈 화면에 추가

### 2단계 - 키오스크 보안 (`KioskGuard.tsx`)

| 보안 항목 | 차단 방법 |
|----------|----------|
| 우클릭 컨텍스트 메뉴 | `contextmenu` 이벤트 `preventDefault()` |
| 개발자 도구 단축키 | `F12`, `Ctrl+Shift+I/C/J`, `Ctrl+U/S/P` 차단 |
| 브라우저 네비게이션 | `history.pushState` + `popstate` 이벤트 차단 |
| 전체화면 이탈 | `fullscreenchange` 감지 → 재진입 안내 오버레이 |
| PWA standalone 모드 | 전체화면 오버레이 비활성 (불필요) |

### 3단계 - 관리자 인증 보안

- 비밀번호 SHA-256 해시 (salt: `hm_admin_2025`) + Web Crypto API
- 구버전 XOR 난독화 자동 마이그레이션
- 15분 세션 타임아웃 (`sessionStorage`)
- 10회 로그인 실패 시 1분 계정 잠금 (`localStorage`)

### 4단계 - 데이터/네트워크 보안

**`next.config.ts` 보안 헤더**:
- `/admin`, `/admin/:path*`: `Cache-Control: no-store, no-cache, must-revalidate`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- `/api/:path*`: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`

**`public/sw.js` Service Worker**:
- Firebase/Google 관련 도메인만 외부 통신 허용
  - `firestore.googleapis.com`, `firebase.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `fonts.googleapis.com`, `fonts.gstatic.com` 등
- `/admin`, `/api` 경로는 캐시 없이 네트워크 직접 요청
- 허용되지 않은 외부 navigate → 403 차단 페이지 반환
- 허용되지 않은 외부 fetch → `{ error: 'Blocked by security policy' }` 403 반환

---

## Firebase 연동 구조

### 인증 (`firebase/client-provider.tsx`)

```
앱 초기화
  → onAuthStateChanged 구독
  → 로그인 안 된 경우: signInAnonymously()
  → isReady = true
  → FirebaseContext에 { db, auth, isReady } 제공
```

### 실시간 쿼리 훅 (`firebase/index.ts`)

**`useCollection<T>(query)`**
- `onSnapshot`으로 실시간 구독
- 반환: `{ data: T[], loading: boolean, error: Error | null }`

**`useFirestore()`**
- FirebaseContext에서 `db` 인스턴스 반환

**`useMemoFirebase(factory, deps)`**
- `useMemo` 래퍼 (Query 객체 메모이제이션으로 불필요한 재구독 방지)

---

## 컴포넌트 상세

### `AttendanceRoster.tsx`
- Props: `entries: AttendanceEntry[]`
- timestamp 역순 정렬 (최신 출석이 상단)
- 학년별 색상 배지 (1학년=파랑, 2학년=초록, 3학년=주황)
- 출석 유형 아이콘: `scan` → `ScanBarcode` 아이콘(파랑), `keypad` → `UserCheck` 아이콘(회색)
- 시간 포맷: `HH:mm:ss` (date-fns format)

### `KioskGuard.tsx`
- 전체 앱을 감싸는 보안 레이어
- PWA standalone 모드 감지: `window.matchMedia('(display-mode: standalone)')`
- 전체화면 이탈 감지 → `fullscreenLost` 상태 → 재진입 오버레이 표시

---

## 스타일 시스템 (`app/globals.css`)

### 커스텀 CSS 클래스

| 클래스 | 용도 |
|--------|------|
| `.glass-card` | 메인 카드 컨테이너 (둥근 모서리, 그림자) |
| `.input-box` | 학번 입력 다이아몬드 5개 박스 |
| `.input-box.filled` | 입력된 자리 (파란색 강조) |
| `.keypad-button` | 숫자 키패드 버튼 (프레스 효과 포함) |
| `.keypad-button-special` | CLR/←  특수 버튼 |
| `.grade-badge-1` | 1학년 배지 (파랑) |
| `.grade-badge-2` | 2학년 배지 (초록) |
| `.grade-badge-3` | 3학년 배지 (주황) |

### 브랜드 색상
- 메인 컬러: `#2672D9` (파랑)
- 배경: `#F8FAFC` (연한 슬레이트)

---

## 상태 관리 전략

### 전역 상태 (Context)
| Context | 제공 값 | 파일 |
|---------|---------|------|
| FirebaseContext | `db`, `auth`, `isReady` | `firebase/client-provider.tsx` |
| ToastContext | toast 함수, toasts 배열 | `hooks/use-toast.ts` |

### 로컬 스토리지 (영속)
| 키 | 값 | 용도 |
|----|----|----|
| `admin_auth` | `sha256:{hex}` | 관리자 비밀번호 해시 |
| `admin_attempts` | 숫자 | 로그인 실패 횟수 |
| `admin_lockout` | 타임스탬프 | 잠금 해제 시각 |
| `backup_{date}` | boolean | 일일 백업 완료 플래그 |

### 세션 스토리지 (탭 단위)
| 키 | 값 | 용도 |
|----|----|----|
| `admin_session_expiry` | 타임스탬프 | 세션 만료 시각 (15분) |

---

## 환경변수 (`.env.local`)

```
# Firebase (NEXT_PUBLIC_ 접두사 = 클라이언트에도 노출)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Notion (서버 전용, 현재 비활성)
NOTION_API_KEY=
NOTION_DATABASE_ID=
NOTION_RANKING_DB_ID=
NOTION_SCAN_LOG_DB_ID=

# 개인 Notion DB (비공개)
PERSONAL_BACKUP_DB_ID=
PERSONAL_STATS_DB_ID=

# 앱 URL
NEXT_PUBLIC_APP_URL=
```

> **주의**: `.env.local`은 절대 git에 커밋하지 않는다. `.gitignore`에 포함되어 있음.

---

## 배포 & 운영

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
# ※ 로컬 경로에 한글 포함 시 Turbopack 오류 발생 가능
# ※ Vercel에서는 ASCII 경로로 정상 빌드됨
npm run build

# Vercel 자동 배포
git push origin main   # main 브랜치 푸쉬 → Vercel 자동 배포
```

### 태블릿 세팅 (갤럭시 탭)

1. 크롬 또는 삼성 인터넷으로 Vercel URL 접속
2. 메뉴(⋮) → 홈 화면에 추가 → 설치
3. 홈화면 **"효명 출결"** 아이콘으로 실행 (주소창 없음 확인)
4. **삼성 앱 고정 모드** 활성화 (홈버튼 탈출 차단)
   - 멀티태스킹(□) → 앱 아이콘 길게 탭 → 앱 고정
   - 해제: 뒤로가기 + 홈버튼 동시에 길게

---

## Notion 연동 (현재 비활성)

아래 기능들은 코드상 존재하지만 현재 stub(빈 함수)으로 비활성화됨:

| 기능 | 파일 | 상태 |
|------|------|------|
| `syncToNotion()` | `app/actions/sync-notion.ts` | 비활성 (return만 있음) |
| `dailyBackupToNotion()` | `lib/daily-backup.ts` | 비활성 (return만 있음) |

Notion 환경변수(`NOTION_API_KEY` 등)는 `.env.local`에 세팅되어 있으나 실제 사용 안 함.
Firestore가 단독 데이터 저장소 역할.

---

## AI 기능 (현재 미사용)

- `app/api/ai/summarize/route.ts`: Gemini API 기반 출석 요약 (Route Handler)
- `@genkit-ai/googleai` + `genkit` 패키지 설치됨
- 향후 출석 패턴 분석, 예측 통계에 활용 예정

---

## 향후 계획

- [ ] 결석 예측 통계 모델 (확통 세특 연계, Gemini API 활용)
- [ ] AI 출석 패턴 분석 리포트 (Gemini API - 인프라 연결됨)
- [ ] Notion 연동 재활성화 또는 완전 제거 결정
- [ ] Firebase Security Rules 점검 및 강화
- [ ] Firebase 2단계 인증(2FA) 활성화

---

## 주요 커밋 이력

| 날짜 | 커밋 해시 | 내용 |
|------|----------|------|
| 2026-03-28 | `cb48d8d` | 스캔 모드 30초 방치 시 키패드 자동 복귀 |
| 2026-03-28 | `b501b8c` | PWA + 키오스크 보안 1~4단계 강화 |
| 2026-03-27 | `d0a7e22` | 헤더 서브타이틀 제거 |
| 2026-03-27 | `059cd40` | 타이틀 오버플로우 수정 (whitespace-nowrap, 폰트 크기 축소) |
| 2026-03-27 | `717f3d1` | NaN classNum/number 버그 수정, 학급별 출석 학생만 표시 |
