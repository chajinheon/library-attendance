'use server';

interface SyncPayload {
  studentId: string;
  studentName: string;
  grade: number;
  date: string;
  monthKey: string;
  monthDisplay: string;
  isCardScan: boolean;
}

// Notion 연동 제거 — 데이터는 Firestore에만 저장
export async function syncToNotion(_payload: SyncPayload): Promise<void> {
  return;
}
