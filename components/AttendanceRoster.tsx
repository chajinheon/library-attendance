'use client';

import { AttendanceEntry } from '@/lib/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { UserCheck, ScanBarcode, LogIn, LogOut } from 'lucide-react';

interface Props {
  entries: AttendanceEntry[];
}

const gradeColors = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-orange-100 text-orange-700',
};

export function AttendanceRoster({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
        <UserCheck className="w-16 h-16 mb-4 opacity-30" />
        <p className="font-black text-lg">아직 출석 기록이 없습니다</p>
        <p className="text-sm mt-1">학번을 입력하거나 바코드를 스캔하세요</p>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    const ta = a.timestamp?.toMillis?.() ?? 0;
    const tb = b.timestamp?.toMillis?.() ?? 0;
    return tb - ta;
  });

  return (
    <div className="divide-y divide-slate-100">
      {sorted.map((entry) => {
        const isCheckout = entry.entryType === 'checkout';
        return (
          <div key={entry.id} className="flex items-center justify-between px-8 py-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4">
              <span className={`text-xs font-black px-2 py-1 rounded-lg ${gradeColors[entry.grade as 1|2|3] ?? 'bg-slate-100 text-slate-600'}`}>
                {entry.grade}학년
              </span>
              <div>
                <p className="font-bold text-slate-800">{entry.studentName}</p>
                <p className="text-xs text-slate-400">{entry.studentId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* 입실/퇴실 배지 */}
              <span className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                isCheckout
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {isCheckout
                  ? <><LogOut className="w-3 h-3" /> 퇴실</>
                  : <><LogIn className="w-3 h-3" /> 입실</>
                }
              </span>
              {/* 스캔/키패드 아이콘 */}
              {entry.type === 'scan' ? (
                <ScanBarcode className="w-4 h-4 text-[#2672D9]" />
              ) : (
                <UserCheck className="w-4 h-4 text-slate-400" />
              )}
              <div className="flex flex-col items-end">
                <p className="text-sm text-slate-500 font-mono">
                  {entry.timestamp?.toDate ? format(entry.timestamp.toDate(), 'HH:mm:ss') : '--:--:--'}
                </p>
                {entry.studyDuration && (
                  <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm mt-0.5">
                    {entry.studyDuration} 학습
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
