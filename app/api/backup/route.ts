import { NextRequest, NextResponse } from 'next/server';

// ── [보안] API 라우트 인증 가드 ──
const INTERNAL_SECRET = process.env.API_INTERNAL_SECRET;

export async function POST(req: NextRequest) {
  // [보안] 내부 시크릿 검증
  if (INTERNAL_SECRET) {
    const authHeader = req.headers.get('x-internal-secret');
    if (authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const apiKey = process.env.NOTION_API_KEY;
  const dbId = process.env.PERSONAL_BACKUP_DB_ID;
  if (!apiKey || !dbId) return NextResponse.json({ ok: false });

  try {
    const { rows } = await req.json();

    // [보안] 입력 타입 검증
    if (!Array.isArray(rows)) {
      return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 });
    }

    // 첫 10건만 샘플 전송 (데이터 확인용)
    const sample = rows.slice(0, 10);
    for (const row of sample) {
      // [보안] 각 필드 타입 검증
      if (typeof row.studentId !== 'string' || typeof row.studentName !== 'string') continue;
      await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            학번: { title: [{ text: { content: row.studentId ?? '' } }] },
            이름: { rich_text: [{ text: { content: row.studentName ?? '' } }] },
            날짜: { date: { start: row.date ?? new Date().toISOString().split('T')[0] } },
            학년: { number: row.grade ?? 0 },
          },
        }),
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
