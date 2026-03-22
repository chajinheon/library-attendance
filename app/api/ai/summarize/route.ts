import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { date, totalStudents, presentCount, gradeBreakdown } = await req.json();

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
