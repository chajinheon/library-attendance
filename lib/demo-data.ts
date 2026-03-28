import { Student, AttendanceEntry } from './types';

// Firebase Timestamp와 같은 인터페이스를 흉내내는 헬퍼
function fakeTimestamp(date: Date) {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
  } as any;
}

function todayAt(hour: number, min: number) {
  const d = new Date();
  d.setHours(hour, min, 0, 0);
  return d;
}

export const DEMO_STUDENTS: Student[] = [
  { id: '30101', studentId: '30101', name: '김민준', grade: 3, classNum: 1, number: 1 },
  { id: '30102', studentId: '30102', name: '이서연', grade: 3, classNum: 1, number: 2 },
  { id: '30103', studentId: '30103', name: '박지호', grade: 3, classNum: 1, number: 3 },
  { id: '20201', studentId: '20201', name: '최수아', grade: 2, classNum: 2, number: 1 },
  { id: '20202', studentId: '20202', name: '정우진', grade: 2, classNum: 2, number: 2 },
  { id: '10301', studentId: '10301', name: '강하은', grade: 1, classNum: 3, number: 1 },
  { id: '10302', studentId: '10302', name: '윤도현', grade: 1, classNum: 3, number: 2 },
];

const today = new Date().toISOString().slice(0, 10);

// 초기 더미 출석: 일부는 입실만, 일부는 입실+퇴실 완료
export const DEMO_ATTENDANCE_INITIAL: AttendanceEntry[] = [
  {
    id: `30101_${today}_in`,
    studentId: '30101', studentName: '김민준',
    timestamp: fakeTimestamp(todayAt(18, 32)),
    date: today, grade: 3, type: 'keypad', entryType: 'checkin',
  },
  {
    id: `30101_${today}_out`,
    studentId: '30101', studentName: '김민준',
    timestamp: fakeTimestamp(todayAt(21, 10)),
    date: today, grade: 3, type: 'keypad', entryType: 'checkout',
  },
  {
    id: `20201_${today}_in`,
    studentId: '20201', studentName: '최수아',
    timestamp: fakeTimestamp(todayAt(18, 45)),
    date: today, grade: 2, type: 'scan', entryType: 'checkin',
  },
  {
    id: `10301_${today}_in`,
    studentId: '10301', studentName: '강하은',
    timestamp: fakeTimestamp(todayAt(19, 3)),
    date: today, grade: 1, type: 'scan', entryType: 'checkin',
  },
];
