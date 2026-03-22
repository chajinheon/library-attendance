export interface Student {
  id: string;
  studentId: string; // 5자리 학번 (예: 30228)
  name: string;
  grade: number; // 1, 2, 3
  classNum: number;
  number: number;
}

export interface AttendanceEntry {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: import('firebase/firestore').Timestamp;
  date: string; // yyyy-MM-dd
  grade: number;
  type: 'scan' | 'keypad';
}

export interface BarcodeMapping {
  id: string;
  barcode: string;
  studentId: string;
}

export interface CardScan {
  id: string;
  rawCode: string;
  studentId: string;
  studentName: string;
  timestamp: import('firebase/firestore').Timestamp;
  date: string;
  monthKey: string; // yyyy-MM
  grade: number;
  point: number;
}
