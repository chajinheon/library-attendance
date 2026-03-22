import { Firestore } from 'firebase/firestore';

// 노션 백업 제거 — 데이터는 Firestore에서 직접 관리
export async function dailyBackupToNotion(_db: Firestore): Promise<void> {
  return;
}
