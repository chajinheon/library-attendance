import { Student, AttendanceEntry } from './types';
import dummyData from './dummy_attendance.json';

// Firebase Timestamp와 같은 인터페이스를 흉내내는 헬퍼
function fakeTimestamp(date: Date) {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
  } as any;
}

// Extract distinct students from the dummy dataset
const uniqueStudents = new Map<string, Student>();
for (const entry of dummyData as any[]) {
  if (!uniqueStudents.has(entry.studentId)) {
    uniqueStudents.set(entry.studentId, {
      id: entry.studentId,
      studentId: entry.studentId,
      name: entry.studentName,
      grade: entry.grade || 1,
      classNum: entry.classNum || 1,
      number: entry.number || 1
    });
  }
}

export const DEMO_STUDENTS: Student[] = Array.from(uniqueStudents.values());

// Map raw JSON into simulated Firebase AttendanceEntry format
export const DEMO_ATTENDANCE_ALL: AttendanceEntry[] = (dummyData as any[]).map((row, index) => ({
  ...row,
  id: row.id || `${row.studentId}_${row.date}_${row.entryType}_${index}`,
  timestamp: row.timestamp ? fakeTimestamp(new Date(row.timestamp)) : null
}));

const todayString = new Date().toISOString().slice(0, 10);
export const DEMO_ATTENDANCE_TODAY: AttendanceEntry[] = DEMO_ATTENDANCE_ALL.filter(a => a.date === todayString);
export const DEMO_ATTENDANCE_INITIAL = DEMO_ATTENDANCE_TODAY; // Backward compatibility for app/page.tsx
