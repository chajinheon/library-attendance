import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        // Vercel 배포 시 자동 도메인 패턴
        '*.vercel.app',
        // Firebase Hosting 도메인
        'studio-7637122488-1dc59.firebaseapp.com',
        'studio-7637122488-1dc59.web.app',
      ],
    },
  },
};

export default nextConfig;
