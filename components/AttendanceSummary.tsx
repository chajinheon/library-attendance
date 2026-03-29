'use client';

import { AttendanceEntry } from '@/lib/types';
import { format } from 'date-fns';
import { Clock, CheckCircle2 } from 'lucide-react';

interface Props {
  entries: AttendanceEntry[];
  currentTime: Date | null;
}

const gradeColors = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
};

export function AttendanceSummary({ entries, currentTime }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
        <Clock className="w-16 h-16 mb-4 opacity-30" />
        <p className="font-black text-lg">기록이 없습니다</p>
      </div>
    );
  }

  // 그룹화: in / out 매핑
  const grouped = new Map<string, { in: AttendanceEntry; out?: AttendanceEntry }>();

  entries.forEach(entry => {
    const existing = grouped.get(entry.studentId);
    if (entry.entryType === 'checkin') {
      if (!existing) {
        grouped.set(entry.studentId, { in: entry });
      } else if (!existing.in || (existing.in.timestamp?.toMillis?.() ?? 0) < (entry.timestamp?.toMillis?.() ?? 0)) {
         existing.in = entry;
      }
    } else {
      if (!existing) {
        grouped.set(entry.studentId, { in: entry, out: entry });
      } else {
        existing.out = entry;
      }
    }
  });

  const summaryList = Array.from(grouped.values()).sort((a, b) => {
    const timeA = a.out?.timestamp?.toMillis?.() ?? a.in.timestamp?.toMillis?.() ?? 0;
    const timeB = b.out?.timestamp?.toMillis?.() ?? b.in.timestamp?.toMillis?.() ?? 0;
    return timeB - timeA;
  });

  return (
    <div className="divide-y divide-slate-100 pb-10">
      {summaryList.map(({ in: inEntry, out: outEntry }) => {
        const isCheckout = !!outEntry;
        const studentName = inEntry.studentName;
        const studentId = inEntry.studentId;
        const grade = inEntry.grade;
        
        let durationText = outEntry?.studyDuration || '';
        
        if (!isCheckout && currentTime && inEntry.timestamp?.toDate) {
          const checkinTime = inEntry.timestamp.toDate();
          const durationMs = currentTime.getTime() - checkinTime.getTime();
          const durationMins = Math.floor(durationMs / (1000 * 60));
          const hours = Math.floor(durationMins / 60);
          const mins = durationMins % 60;
          durationText = hours > 0 ? `${hours}시간 ${mins}분 (진행 중)` : `${mins}분 (진행 중)`;
        }

        return (
          <div key={studentId} className="flex items-center justify-between px-8 py-5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4">
              <span className={`text-xs font-black px-2 py-1 rounded-lg ${gradeColors[grade as 1|2|3] ?? 'bg-slate-100 text-slate-600'}`}>
                {grade}학년
              </span>
              <div>
                <p className="font-bold text-slate-800 text-lg">{studentName}</p>
                <p className="text-xs text-slate-400">{studentId}</p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5">
              {isCheckout ? (
                <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-sm text-emerald-700">{outEntry.studyDuration} 학습 완료</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 animate-pulse">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-sm text-blue-700">{durationText}</span>
                </div>
              )}
              <p className="text-xs text-slate-400 font-mono">
                입실: {inEntry.timestamp?.toDate ? format(inEntry.timestamp.toDate(), 'HH:mm') : '--:--'}
                {outEntry && outEntry.timestamp?.toDate && ` • 퇴실: ${format(outEntry.timestamp.toDate(), 'HH:mm')}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
