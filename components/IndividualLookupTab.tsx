'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, Calendar, ChevronRight, User } from 'lucide-react';
import { Student, AttendanceEntry } from '@/lib/types';
import { DEMO_ATTENDANCE_ALL } from '@/lib/demo-data';

interface Props {
  students: Student[];
  isDemo: boolean;
}

export function IndividualLookupTab({ students, isDemo }: Props) {
  const db = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [logs, setLogs] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const lower = searchQuery.toLowerCase();
    return students.filter(s => s.name.toLowerCase().includes(lower) || s.studentId.includes(lower));
  }, [students, searchQuery]);

  useEffect(() => {
    if (!selectedStudent) {
      setLogs([]);
      return;
    }
    setLoading(true);
    if (isDemo) {
      const demoLogs = DEMO_ATTENDANCE_ALL.filter(l => l.studentId === selectedStudent.studentId) as AttendanceEntry[];
      setLogs(demoLogs);
      setLoading(false);
      return;
    }

    if (!db) {
      setLoading(false);
      return;
    }

    const fetchLogs = async () => {
      try {
        const q = query(
          collection(db, 'attendance_logs'),
          where('studentId', '==', selectedStudent.studentId)
        );
        const snap = await getDocs(q);
        const fetchedLogs = snap.docs.map(d => d.data() as AttendanceEntry);
        // Sort client-side by timestamp DESC
        fetchedLogs.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
        setLogs(fetchedLogs);
      } catch (e) {
        console.error('Failed to fetch individual logs:', e);
      }
      setLoading(false);
    };
    fetchLogs();
  }, [selectedStudent, db, isDemo]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const map = new Map<string, { in?: AttendanceEntry; out?: AttendanceEntry }>();
    logs.forEach(log => {
      const key = log.date;
      if (!map.has(key)) map.set(key, {});
      const existing = map.get(key)!;
      if (log.entryType === 'checkin') {
        if (!existing.in || (existing.in.timestamp?.toMillis?.() ?? 0) < (log.timestamp?.toMillis?.() ?? 0)) {
           existing.in = log;
        }
      } else {
        existing.out = log;
      }
    });
    // Sort array by date descending
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  // Derived analytical statistics
  const stats = useMemo(() => {
    let totalMs = 0;
    let uncompletedCount = 0;
    let maxStudyMs = 0;
    
    groupedLogs.forEach(([_, entries]) => {
      const inMs = entries.in?.timestamp?.toMillis?.() ?? 0;
      const outMs = entries.out?.timestamp?.toMillis?.() ?? 0;
      
      if (inMs && outMs) {
        const diff = outMs - inMs;
        totalMs += diff;
        if (diff > maxStudyMs) maxStudyMs = diff;
      } else {
        uncompletedCount++;
      }
    });

    const totalHours = Math.floor(totalMs / 3600000);
    const totalMins = Math.floor((totalMs % 3600000) / 60000);
    
    const avgMs = groupedLogs.length > 0 ? totalMs / groupedLogs.length : 0;
    const avgHours = Math.floor(avgMs / 3600000);
    const avgMins = Math.floor((avgMs % 3600000) / 60000);

    const maxHours = Math.floor(maxStudyMs / 3600000);
    const maxMins = Math.floor((maxStudyMs % 3600000) / 60000);

    return {
      totalHours, totalMins,
      avgHours, avgMins,
      maxHours, maxMins,
      uncompletedCount,
      totalDays: groupedLogs.length
    };
  }, [groupedLogs]);

  return (
    <div className="flex gap-6 h-[calc(100vh-160px)]">
      {/* Left: Search & Student List */}
      <div className="w-80 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="이름 또는 학번 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#2672D9] focus:ring-1 focus:ring-[#2672D9] transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredStudents.length === 0 ? (
            <div className="text-center text-slate-400 py-10 text-sm">검색 결과가 없습니다.</div>
          ) : (
            <div className="space-y-1">
              {filteredStudents.map(student => (
                <button
                  key={student.studentId}
                  onClick={() => setSelectedStudent(student)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    selectedStudent?.studentId === student.studentId 
                    ? 'bg-[#2672D9] text-white shadow-md' 
                    : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      selectedStudent?.studentId === student.studentId ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {student.name[0]}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm leading-none">{student.name}</p>
                      <p className={`text-xs mt-1 ${selectedStudent?.studentId === student.studentId ? 'text-blue-100' : 'text-slate-400'}`}>
                        {student.studentId}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${selectedStudent?.studentId === student.studentId ? 'text-white/70' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Data View */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col relative">
        {!selectedStudent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <User className="w-16 h-16 opacity-20 mb-4" />
            <p className="font-bold">좌측에서 학생을 선택해주세요</p>
            <p className="text-sm mt-2 opacity-70">이름이나 학번으로 원하는 학생을 찾을 수 있습니다.</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-4 border-[#2672D9] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold">학생의 과거 기록을 분석하고 있습니다...</p>
          </div>
        ) : (
          <>
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">{selectedStudent.name} <span className="text-xl text-slate-400 font-bold ml-2">#{selectedStudent.studentId}</span></h2>
                  <p className="text-sm font-semibold text-slate-500 mt-1">{selectedStudent.grade}학년 {selectedStudent.classNum}반 {selectedStudent.number}번</p>
                </div>
                {stats.uncompletedCount > 0 && (
                  <div className="px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 font-bold text-xs flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    미퇴실 기록 {stats.uncompletedCount}건
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center transition-transform hover:-translate-y-1">
                  <p className="text-xs font-bold text-slate-400 mb-1">총 출석 일수</p>
                  <p className="text-2xl font-black text-slate-800">{stats.totalDays}<span className="text-base font-bold text-slate-400 ml-1">일</span></p>
                </div>
                <div className="p-4 bg-gradient-to-br from-[#2672D9] to-blue-600 rounded-2xl shadow-md shadow-blue-500/20 flex flex-col justify-center transition-transform hover:-translate-y-1">
                  <p className="text-xs font-bold text-blue-200 mb-1">누적 학습 시간</p>
                  <p className="text-2xl font-black text-white">{stats.totalHours}<span className="text-base font-bold text-blue-200 mx-1">시간</span>{stats.totalMins}<span className="text-base font-bold text-blue-200 ml-1">분</span></p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center transition-transform hover:-translate-y-1">
                  <p className="text-xs font-bold text-slate-400 mb-1">일평균 학습 시간</p>
                  <p className="text-2xl font-black text-slate-800">{stats.avgHours}<span className="text-base font-bold text-slate-400 mx-1">h</span>{stats.avgMins}<span className="text-base font-bold text-slate-400 ml-1">m</span></p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center transition-transform hover:-translate-y-1">
                  <p className="text-xs font-bold text-amber-500 mb-1">최대 집중 (하루)</p>
                  <p className="text-2xl font-black text-slate-800">{stats.maxHours}<span className="text-base font-bold text-slate-400 mx-1">h</span>{stats.maxMins}<span className="text-base font-bold text-slate-400 ml-1">m</span></p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
              {groupedLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 py-20">
                  <Calendar className="w-12 h-12 opacity-20 mb-4" />
                  <p className="font-bold text-lg text-slate-500">출석 이력이 없습니다.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pb-10">
                  {groupedLogs.map(([date, entries]) => {
                    let durationText = entries.out?.studyDuration;
                    if (!durationText && entries.in && entries.out) {
                      const inMs = entries.in.timestamp?.toMillis?.() ?? 0;
                      const outMs = entries.out.timestamp?.toMillis?.() ?? 0;
                      if (inMs && outMs) {
                        const diffMs = outMs - inMs;
                        const hours = Math.floor(diffMs / 3600000);
                        const minutes = Math.floor((diffMs % 3600000) / 60000);
                        durationText = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
                      }
                    }
                    if (!durationText) {
                      durationText = entries.out ? '시간 불명' : '학습 진행 중 (또는 미퇴실)';
                    }
                    
                    const inTime = entries.in?.timestamp?.toDate ? new Date(entries.in.timestamp.toDate()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : entries.in?.timestamp ? '알수없음' : '--:--';
                    const outTime = entries.out?.timestamp?.toDate ? new Date(entries.out.timestamp.toDate()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
                    
                    return (
                      <div key={date} className="relative pl-8 pb-4">
                        {/* Timeline dot */}
                        <div className="absolute -left-[9px] top-1.5 w-4 h-4 bg-white border-4 border-[#2672D9] rounded-full shadow-sm" />
                        
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-black text-slate-800 text-lg">{date}</h3>
                        </div>
                        
                        <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm inline-block min-w-[320px] hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-slate-500 font-bold">결과 학습 시간</span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${entries.out ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                              {durationText}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-slate-600 font-mono text-sm bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-bold text-xs">IN</span>
                              <span className="font-bold text-slate-700">{inTime}</span>
                            </div>
                            {entries.out && (
                              <div className="flex justify-between items-center border-t border-slate-200/60 pt-2 mt-1">
                                <span className="text-slate-400 font-bold text-xs">OUT</span>
                                <span className="font-bold text-slate-700">{outTime}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
