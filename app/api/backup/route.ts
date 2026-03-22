import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.NOTION_API_KEY;
  const dbId = process.env.PERSONAL_BACKUP_DB_ID;
  if (!apiKey || !dbId) return NextResponse.json({ ok: false });

  try {
    const { rows } = await req.json();
    // 첫 10건만 샘플 전송 (데이터 확인용)
    const sample = rows.slice(0, 10);
    for (const row of sample) {
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
