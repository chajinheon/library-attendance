import { NextRequest, NextResponse } from 'next/server';

// ── [보안] API 라우트 인증 가드 ──
// 클라이언트는 NEXT_PUBLIC_API_INTERNAL_SECRET을 헤더에 담아 요청해야 합니다.
const INTERNAL_SECRET = process.env.API_INTERNAL_SECRET;

export async function POST(req: NextRequest) {
  // [보안] 내부 시크릿 검증 (없으면 401 반환)
  if (INTERNAL_SECRET) {
    const authHeader = req.headers.get('x-internal-secret');
    if (authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { date, totalStudents, presentCount, gradeBreakdown } = await req.json();

    // [보안] 입력값 기본 타입 검증
    if (typeof date !== 'string' || typeof totalStudents !== 'number' || typeof presentCount !== 'number') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ summary: '(AI 키 미설정)' });
    }

    const prompt = `
다음은 효명고등학교 야간자율학습 출결 현황입니다.
날짜: ${date}
전체 학생: ${totalStudents}명
출석: ${presentCount}명
미출석: ${totalStudents - presentCount}명
학년별: ${JSON.stringify(gradeBreakdown)}

위 데이터를 바탕으로 오늘의 출결 현황을 한국어로 2-3문장으로 간결하게 요약해주세요.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '요약 생성 실패';
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ summary: '요약 생성 중 오류가 발생했습니다.' });
  }
}
