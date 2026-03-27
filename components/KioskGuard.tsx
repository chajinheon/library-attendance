'use client';

import { useEffect, useState } from 'react';

/**
 * KioskGuard
 * ──────────────────────────────────────────────────────────────
 * 태블릿 키오스크 보안 레이어
 *
 * [차단 목록]
 * - 우클릭 컨텍스트 메뉴
 * - F12 / Ctrl+Shift+I / Ctrl+Shift+C / Ctrl+Shift+J (개발자 도구)
 * - Ctrl+U (소스 보기) / Ctrl+S (저장) / Ctrl+P (인쇄)
 * - 브라우저 뒤로가기 / 앞으로가기 제스처
 *
 * [전체화면 감지]
 * - 브라우저 모드에서 전체화면이 해제되면 재진입 안내 오버레이 표시
 * - PWA standalone 모드에서는 해당 없음 (이미 전체화면 상태)
 */
export function KioskGuard() {
  const [fullscreenLost, setFullscreenLost] = useState(false);

  useEffect(() => {
    // ── 1. 우클릭 차단 ──
    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // ── 2. 위험 단축키 차단 (capture phase에서 가로챔) ──
    const blockShortcuts = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const k = e.key;

      const blocked =
        // 개발자 도구
        k === 'F12' ||
        (ctrl && shift && ['I', 'i', 'C', 'c', 'J', 'j'].includes(k)) ||
        // 소스 보기
        (ctrl && ['u', 'U'].includes(k)) ||
        // 파일 저장
        (ctrl && ['s', 'S'].includes(k)) ||
        // 인쇄 다이얼로그
        (ctrl && ['p', 'P'].includes(k));

      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // ── 3. 뒤로가기 / 앞으로가기 무력화 ──
    // 현재 URL을 history에 쌓아두어 popstate 발생 시 제자리로 복귀
    history.pushState(null, '', window.location.href);
    const blockNavigation = () => {
      history.pushState(null, '', window.location.href);
    };

    // ── 4. 전체화면 이탈 감지 ──
    // PWA standalone 모드에서는 작동 안 함 (display-mode 확인)
    const handleFullscreenChange = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches;

      if (!document.fullscreenElement && !isStandalone) {
        setFullscreenLost(true);
      } else {
        setFullscreenLost(false);
      }
    };

    // 이벤트 등록
    document.addEventListener('contextmenu', blockContextMenu, true);
    document.addEventListener('keydown', blockShortcuts, true);
    window.addEventListener('popstate', blockNavigation);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // 일부 구형 Android WebView 대응
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu, true);
      document.removeEventListener('keydown', blockShortcuts, true);
      window.removeEventListener('popstate', blockNavigation);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // ── 전체화면 재진입 요청 ──
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      setFullscreenLost(false);
    } catch {
      // 전체화면 API 미지원 환경 (standalone 등) - 프롬프트 닫기
      setFullscreenLost(false);
    }
  };

  if (!fullscreenLost) return null;

  // ── 전체화면 이탈 안내 오버레이 ──
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(15, 23, 42, 0.92)' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="bg-white rounded-3xl p-10 text-center max-w-xs w-[88%] shadow-2xl">
        {/* 아이콘 */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: '#FEF9C3' }}
        >
          <span style={{ fontSize: '2rem' }}>🔒</span>
        </div>

        <h2 className="text-xl font-black text-slate-800 mb-2">전체화면 필요</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-7">
          보안 정책상 전체화면을 유지해야 합니다.
          <br />
          아래 버튼을 눌러 계속하세요.
        </p>

        <button
          onClick={enterFullscreen}
          className="w-full text-white font-bold py-3.5 px-6 rounded-2xl text-base transition-colors"
          style={{ background: '#2672D9' }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#1a5fc8')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#2672D9')}
        >
          전체화면으로 돌아가기
        </button>
      </div>
    </div>
  );
}
