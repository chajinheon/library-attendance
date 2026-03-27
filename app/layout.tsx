'use client';

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { KioskGuard } from '@/components/KioskGuard';
import { useEffect } from 'react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    // ── HTTPS 강제 리다이렉트 ──
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'http:' &&
      !window.location.hostname.includes('localhost') &&
      !window.location.hostname.includes('127.0.0.1')
    ) {
      const secureUrl = window.location.href.replace('http:', 'https:');
      window.location.replace(secureUrl);
    }

    // ── Service Worker 등록 ──
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => console.warn('[SW] 등록 실패:', err));
    }
  }, []);

  return (
    <html lang="ko">
      <head>
        <title>효명고 야간자율학습 출결</title>
        <meta name="description" content="스마트 학생 출결 관리 시스템" />

        {/* ── PWA 설정 ── */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2672D9" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="효명 출결" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />

        {/* ── 뷰포트: 확대/축소 방지 ── */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />

        {/* ── 폰트 ── */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased bg-white min-h-screen">
        <FirebaseClientProvider>
          {/* 키오스크 보안 레이어: 우클릭·단축키 차단, 전체화면 감지 */}
          <KioskGuard />
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
