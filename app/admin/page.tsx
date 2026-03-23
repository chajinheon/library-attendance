'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Student, AttendanceEntry, BarcodeMapping } from '@/lib/types';
import {
  Settings, Users, UserCheck, LogOut, Plus, Trash2, Search,
  Download, RefreshCw, AlertTriangle, ChevronLeft,
  ScanBarcode, BookOpen, History, Shield, Eye, EyeOff, Trophy,
  LayoutDashboard, X, BarChart2, TrendingUp, Clock, Activity, BookMarked, MessageCircle
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, getDoc, getDocs, setDoc,
  deleteDoc, writeBatch, serverTimestamp, orderBy, limit
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ────────────────────────────────────────────
// Simple XOR-based obfuscation for localStorage
// ────────────────────────────────────────────
const SALT = 'hm_admin_2025';
function obfuscate(text: string): string {
  return btoa(text.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ SALT.charCodeAt(i % SALT.length))).join(''));
}
function deobfuscate(encoded: string): string {
  try {
    const text = atob(encoded);
    return text.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ SALT.charCodeAt(i % SALT.length))).join('');
  } catch { return ''; }
}

const DEFAULT_PASSWORD = 'admin1234';
const AUTH_KEY = 'admin_auth';
const LOCKOUT_KEY = 'admin_lockout';
const ATTEMPTS_KEY = 'admin_attempts';
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 60 * 1000;
const MASTER_KEY = '@@@@';

type Tab = 'attendance' | 'students' | 'history' | 'barcode' | 'ranking' | 'settings' | 'guide' | 'contact';

const gradeColors: Record<number, string> = {
  1: 'bg-blue-100 text-blue-700 border-blue-200',
  2: 'bg-green-100 text-green-700 border-green-200',
  3: 'bg-orange-100 text-orange-700 border-orange-200',
};

// ────────────────────────────────────────────
// Secret Stats Overlay (1105 trigger)
// ────────────────────────────────────────────
function SecretStats({ db, onClose }: { db: any; onClose: () => void }) {
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // 기간 필터: '30' | '90' | 'all'
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('90');
  // 초기화 관련
  const [resetConfirm, setResetConfirm] = useState<'idle' | 'today' | 'all'>('idle');
  const [resetting, setResetting] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // ── 데이터 로드 (기간별) ──
  useEffect(() => {
    if (!db) return;
    setLoading(true);
    (async () => {
      // 전체 카운트는 항상 가져옴 (한 번만 읽기 최소화)
      let q;
      if (period === 'all') {
        q = query(collection(db, 'attendance_logs'), orderBy('date', 'desc'));
      } else {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(period));
        const cutoffStr = format(cutoff, 'yyyy-MM-dd');
        q = query(collection(db, 'attendance_logs'), where('date', '>=', cutoffStr), orderBy('date', 'desc'));
      }
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => d.data());
      setAllLogs(logs);
      setTotalCount(prev => period === 'all' ? logs.length : Math.max(prev, logs.length));
      setLoading(false);
    })();
  }, [db, period]);

  // ── 오늘 출석 초기화 ──
  const handleResetToday = async () => {
    if (!db) return;
    setResetting(true);
    try {
      const [logsSnap, scansSnap] = await Promise.all([
        getDocs(query(collection(db, 'attendance_logs'), where('date', '==', todayStr))),
        getDocs(query(collection(db, 'card_scans'), where('date', '==', todayStr))),
      ]);
      const allDocs = [...logsSnap.docs, ...scansSnap.docs];
      for (let i = 0; i < allDocs.length; i += 400) {
        const batch = writeBatch(db);
        allDocs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      setAllLogs(prev => prev.filter(l => l.date !== todayStr));
      setResetConfirm('idle');
    } catch { /* silent */ }
    setResetting(false);
  };

  // ── 전체 출석 초기화 ──
  const handleResetAll = async () => {
    if (!db) return;
    setResetting(true);
    try {
      const [logsSnap, scansSnap] = await Promise.all([
        getDocs(collection(db, 'attendance_logs')),
        getDocs(collection(db, 'card_scans')),
      ]);
      const allDocs = [...logsSnap.docs, ...scansSnap.docs];
      for (let i = 0; i < allDocs.length; i += 400) {
        const batch = writeBatch(db);
        allDocs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      setAllLogs([]);
      setTotalCount(0);
      setResetConfirm('idle');
    } catch { /* silent */ }
    setResetting(false);
  };

  // ── 통계 계산 ──
  const stats = useMemo(() => {
    if (!allLogs.length) return null;

    // 날짜별 출석 수 (최근 30일)
    const dateMap: Record<string, number> = {};
    const hourMap: Record<number, number> = {};
    const gradeMap: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const typeMap = { scan: 0, keypad: 0 };
    const weekdayMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    for (const log of allLogs) {
      // 날짜별
      dateMap[log.date] = (dateMap[log.date] ?? 0) + 1;
      // 학년별
      const g = Number(log.grade);
      if (g >= 1 && g <= 3) gradeMap[g]++;
      // 유형별
      if (log.type === 'scan') typeMap.scan++;
      else typeMap.keypad++;
      // 시간대별 & 요일별
      if (log.timestamp?.toDate) {
        const d = log.timestamp.toDate();
        const h = d.getHours();
        hourMap[h] = (hourMap[h] ?? 0) + 1;
        weekdayMap[d.getDay()] = (weekdayMap[d.getDay()] ?? 0) + 1;
      }
    }

    // 최근 14일 날짜 배열
    const recentDates: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      recentDates.push(format(d, 'yyyy-MM-dd'));
    }
    const dailyCounts = recentDates.map(date => ({ date, count: dateMap[date] ?? 0 }));

    // 시간대 18~22시
    const hourData = Array.from({ length: 6 }, (_, i) => ({
      hour: i + 17,
      count: hourMap[i + 17] ?? 0,
    }));

    const totalDays = Object.keys(dateMap).length;
    const avgPerDay = totalDays > 0 ? Math.round(allLogs.length / totalDays) : 0;
    const maxDay = Object.entries(dateMap).sort((a, b) => b[1] - a[1])[0];
    const peakHour = Object.entries(hourMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekdayData = weekdays.map((name, i) => ({ name, count: weekdayMap[i] }));

    return { dailyCounts, hourData, gradeMap, typeMap, totalDays, avgPerDay, maxDay, peakHour, weekdayData, total: allLogs.length };
  }, [allLogs]);

  // ── SVG 막대 차트 helper ──
  function BarChart({ data, colorFn, labelFn }: {
    data: { label: string; value: number }[];
    colorFn?: (i: number) => string;
    labelFn?: (v: number) => string;
  }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
      <div className="flex items-end gap-1 h-24 w-full">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-slate-400 font-mono tabular-nums">
              {d.value > 0 ? (labelFn ? labelFn(d.value) : d.value) : ''}
            </span>
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${Math.max((d.value / max) * 72, d.value > 0 ? 4 : 0)}px`,
                backgroundColor: colorFn ? colorFn(i) : '#2672D9',
              }}
            />
            <span className="text-[9px] text-slate-500 truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
    );
  }

  // ── 도넛 차트 helper ──
  function DonutChart({ slices, size = 80 }: { slices: { value: number; color: string; label: string }[]; size?: number }) {
    const total = slices.reduce((s, d) => s + d.value, 0);
    if (total === 0) return <div className="w-20 h-20 rounded-full bg-slate-100" />;
    let cumulative = 0;
    const r = size / 2 - 8;
    const cx = size / 2;
    const cy = size / 2;
    const paths = slices.map(slice => {
      const pct = slice.value / total;
      const start = cumulative;
      cumulative += pct;
      const startAngle = start * 2 * Math.PI - Math.PI / 2;
      const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const large = pct > 0.5 ? 1 : 0;
      return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: slice.color };
    });
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} />)}
        <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
      </svg>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-[#2672D9]" />
              <h1 className="text-white font-black text-xl">출결 통계 분석</h1>
              <span className="text-xs bg-[#2672D9]/20 text-[#2672D9] px-2 py-0.5 rounded-full font-bold border border-[#2672D9]/30">PRIVATE</span>
            </div>
            <p className="text-slate-400 text-sm">효명고 야간자율학습 · attendance_logs 영구 보존</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 기간 필터 + Firestore 쿼터 안내 */}
        <div className="flex items-center justify-between mb-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-medium">조회 기간</span>
            {(['30', '90', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold border transition-all',
                  period === p ? 'bg-[#2672D9] text-white border-[#2672D9]' : 'text-slate-400 border-slate-700 hover:border-slate-500'
                )}
              >
                {p === 'all' ? '전체' : `최근 ${p}일`}
              </button>
            ))}
          </div>
          <div className="text-right">
            <span className="text-slate-500 text-xs">
              {period === 'all' ? '전체' : `최근 ${period}일`} <span className="text-white font-bold">{allLogs.length.toLocaleString()}건</span> 로드
              {period !== 'all' && totalCount > 0 && <span className="text-slate-600"> (누적 보존 중)</span>}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-[#2672D9] animate-spin" />
          </div>
        ) : !stats ? (
          <p className="text-slate-400 text-center py-20">출석 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {/* 요약 카드 4개 */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '총 출석 건수', value: stats.total.toLocaleString(), unit: '건', icon: UserCheck, color: 'text-emerald-400' },
                { label: '출석 일수', value: stats.totalDays, unit: '일', icon: BarChart2, color: 'text-blue-400' },
                { label: '일 평균 출석', value: stats.avgPerDay, unit: '명', icon: TrendingUp, color: 'text-amber-400' },
                { label: '피크 시간대', value: stats.peakHour ? `${stats.peakHour[0]}시` : '-', unit: '', icon: Clock, color: 'text-purple-400' },
              ].map(({ label, value, unit, icon: Icon, color }) => (
                <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn('w-3.5 h-3.5', color)} />
                    <p className="text-slate-400 text-xs font-medium">{label}</p>
                  </div>
                  <p className="text-white font-black text-2xl">{value}<span className="text-slate-500 text-sm font-medium ml-1">{unit}</span></p>
                </div>
              ))}
            </div>

            {/* 최근 14일 추이 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2672D9]" /> 최근 14일 출석 추이
              </h3>
              <BarChart
                data={stats.dailyCounts.map(d => ({
                  label: d.date.slice(5),
                  value: d.count,
                }))}
                colorFn={(i) => i === 13 ? '#2672D9' : '#334155'}
              />
            </div>

            {/* 하단 3열 */}
            <div className="grid grid-cols-3 gap-3">
              {/* 학년별 분포 */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-white font-bold text-sm mb-4">학년별 출석 분포</h3>
                <div className="flex items-center gap-4">
                  <DonutChart slices={[
                    { value: stats.gradeMap[1], color: '#3b82f6', label: '1학년' },
                    { value: stats.gradeMap[2], color: '#22c55e', label: '2학년' },
                    { value: stats.gradeMap[3], color: '#f97316', label: '3학년' },
                  ]} />
                  <div className="space-y-2">
                    {[
                      { grade: 1, color: '#3b82f6' },
                      { grade: 2, color: '#22c55e' },
                      { grade: 3, color: '#f97316' },
                    ].map(({ grade, color }) => {
                      const total = stats.gradeMap[1] + stats.gradeMap[2] + stats.gradeMap[3];
                      const pct = total > 0 ? Math.round(stats.gradeMap[grade] / total * 100) : 0;
                      return (
                        <div key={grade} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-slate-300 text-xs">{grade}학년</span>
                          <span className="text-white text-xs font-bold ml-auto">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 방식별 비율 */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-white font-bold text-sm mb-4">체크인 방식</h3>
                <div className="flex items-center gap-4">
                  <DonutChart slices={[
                    { value: stats.typeMap.scan, color: '#2672D9', label: '바코드' },
                    { value: stats.typeMap.keypad, color: '#64748b', label: '키패드' },
                  ]} />
                  <div className="space-y-2">
                    {[
                      { label: '바코드', value: stats.typeMap.scan, color: '#2672D9' },
                      { label: '키패드', value: stats.typeMap.keypad, color: '#64748b' },
                    ].map(({ label, value, color }) => {
                      const total = stats.typeMap.scan + stats.typeMap.keypad;
                      const pct = total > 0 ? Math.round(value / total * 100) : 0;
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-slate-300 text-xs">{label}</span>
                          <span className="text-white text-xs font-bold ml-auto">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 요일별 분포 */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-white font-bold text-sm mb-4">요일별 출석</h3>
                <BarChart
                  data={stats.weekdayData.map(d => ({ label: d.name, value: d.count }))}
                  colorFn={(i) => ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'][i] + '99'}
                />
              </div>
            </div>

            {/* 시간대별 분포 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> 시간대별 체크인 분포 (17~22시)
              </h3>
              <BarChart
                data={stats.hourData.map(d => ({ label: `${d.hour}시`, value: d.count }))}
                colorFn={() => '#f59e0b'}
                labelFn={v => v.toLocaleString()}
              />
            </div>

            {/* 최고 기록일 */}
            {stats.maxDay && (
              <div className="bg-gradient-to-r from-[#2672D9]/20 to-slate-900 border border-[#2672D9]/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs mb-1">역대 최다 출석일</p>
                  <p className="text-white font-black text-lg">{stats.maxDay[0]}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#2672D9] font-black text-3xl">{stats.maxDay[1]}<span className="text-sm text-slate-400 ml-1">명</span></p>
                </div>
              </div>
            )}

            {/* 전체 데이터 다운로드 — 이 화면에서만 접근 가능 */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
              {/* 다운로드 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">전체 출석 데이터 내보내기</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    현재 조회된 <span className="text-white font-bold">{allLogs.length.toLocaleString()}건</span> 다운로드
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!db) return;
                    // 다운로드는 항상 전체 데이터
                    const snap = await getDocs(query(collection(db, 'attendance_logs'), orderBy('date', 'desc')));
                    const logs = snap.docs.map(d => d.data());
                    if (!logs.length) return;
                    const rows = logs.map(log => [
                      log.date ?? '',
                      log.studentId ?? '',
                      log.studentName ?? '',
                      log.grade ?? '',
                      log.type ?? '',
                      log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss') : '',
                    ].join(','));
                    const csv = ['날짜,학번,이름,학년,방식,시각', ...rows].join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `효명고_출결_전체_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#2672D9] hover:bg-[#1e5bb8] text-white font-bold text-sm rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" /> CSV 전체 다운로드
                </button>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">테스트 초기화</p>

                {/* 오늘 초기화 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-sm font-semibold">오늘 출석 초기화</p>
                    <p className="text-slate-500 text-xs">{todayStr} 데이터만 삭제</p>
                  </div>
                  {resetConfirm !== 'today' ? (
                    <button onClick={() => setResetConfirm('today')} className="px-3 py-1.5 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-700/50 text-amber-400 text-xs font-bold rounded-xl transition-colors">
                      초기화
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleResetToday} disabled={resetting} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors">
                        {resetting ? '삭제 중...' : '확인'}
                      </button>
                      <button onClick={() => setResetConfirm('idle')} className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-bold rounded-xl">취소</button>
                    </div>
                  )}
                </div>

                {/* 전체 초기화 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-400 text-sm font-semibold">전체 데이터 초기화</p>
                    <p className="text-slate-500 text-xs">모든 출석 기록 영구 삭제 — 되돌릴 수 없음</p>
                  </div>
                  {resetConfirm !== 'all' ? (
                    <button onClick={() => setResetConfirm('all')} className="px-3 py-1.5 bg-red-950/40 hover:bg-red-950/60 border border-red-800/50 text-red-400 text-xs font-bold rounded-xl transition-colors">
                      전체 삭제
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleResetAll} disabled={resetting} className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition-colors">
                        {resetting ? '삭제 중...' : '정말 삭제'}
                      </button>
                      <button onClick={() => setResetConfirm('idle')} className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-bold rounded-xl">취소</button>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-slate-700 text-xs border-t border-slate-800 pt-3">
                ※ attendance_logs는 앱 업데이트·학년 전환과 무관하게 Firebase에 영구 보존됩니다. 초기화는 이 화면에서만 가능합니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Login screen
// ────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void | Promise<void> }) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // 페이지 나갔다 돌아올 때 비번 초기화
  useEffect(() => {
    setPassword('');
    return () => setPassword('');
  }, []);
  const [error, setError] = useState('');
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) ?? '0');
      const remaining = Math.max(0, lockoutUntil - Date.now());
      setLockoutRemaining(remaining);
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, []);

  const handleLogin = () => {
    // 마스터 키는 잠금 중에도 항상 통과
    if (password === MASTER_KEY) {
      localStorage.setItem(ATTEMPTS_KEY, '0');
      localStorage.removeItem(LOCKOUT_KEY);
      onLogin();
      return;
    }

    const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) ?? '0');
    if (Date.now() < lockoutUntil) return;

    const stored = localStorage.getItem(AUTH_KEY);
    const currentPw = stored ? deobfuscate(stored) : DEFAULT_PASSWORD;

    if (password === currentPw) {
      localStorage.setItem(ATTEMPTS_KEY, '0');
      onLogin();
    } else {
      const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) ?? '0') + 1;
      localStorage.setItem(ATTEMPTS_KEY, String(attempts));
      if (attempts >= MAX_ATTEMPTS) {
        localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
        localStorage.setItem(ATTEMPTS_KEY, '0');
        setError(`${MAX_ATTEMPTS}회 실패. 1분간 잠금됩니다.`);
      } else {
        setError(`비밀번호가 틀렸습니다. (${attempts}/${MAX_ATTEMPTS})`);
      }
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#2672D9] rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-2xl mx-auto mb-4">
            H
          </div>
          <h1 className="text-2xl font-black text-white">관리자 로그인</h1>
          <p className="text-slate-400 text-sm mt-1">효명고 야간자율학습 출결 관리</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          {lockoutRemaining > 0 ? (
            <div className="space-y-3">
              <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="font-bold text-red-400">잠금 중</p>
                <p className="text-sm text-red-500/80">{Math.ceil(lockoutRemaining / 1000)}초 후 재시도 가능</p>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="해제 키 입력"
                autoComplete="new-password"
                name="unlock-key"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-base font-medium placeholder:text-slate-500 focus:outline-none focus:border-[#2672D9] focus:ring-2 focus:ring-[#2672D9]/20 transition-all"
              />
              <button
                onClick={handleLogin}
                className="w-full h-10 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-sm transition-colors"
              >
                해제
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="비밀번호 입력"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-base font-medium placeholder:text-slate-500 focus:outline-none focus:border-[#2672D9] focus:ring-2 focus:ring-[#2672D9]/20 pr-12 transition-all"
                  autoComplete="new-password"
                  name="admin-pw"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <button
                onClick={handleLogin}
                className="w-full h-12 bg-[#2672D9] hover:bg-[#1e5bb8] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Shield className="w-4 h-4" /> 로그인
              </button>
            </>
          )}
          <Link href="/">
            <button className="w-full h-10 text-slate-500 hover:text-slate-300 text-sm font-medium flex items-center justify-center gap-1 transition-colors">
              <ChevronLeft className="w-4 h-4" /> 메인으로 돌아가기
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Stat pill component
// ────────────────────────────────────────────
function StatPill({ label, value, unit = '명', accent }: { label: string; value: number; unit?: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
      <div className={cn('w-2 h-2 rounded-full shrink-0', accent ?? 'bg-slate-300')} />
      <div>
        <p className="text-xs text-slate-400 font-medium leading-none mb-0.5">{label}</p>
        <p className="text-lg font-black text-slate-800 leading-none">
          {value}<span className="text-xs font-medium text-slate-400 ml-0.5">{unit}</span>
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Grade filter buttons
// ────────────────────────────────────────────
function GradeFilter({ value, onChange }: { value: number | 'all'; onChange: (v: number | 'all') => void }) {
  return (
    <div className="flex gap-1.5">
      {(['all', 1, 2, 3] as const).map(g => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
            value === g
              ? g === 'all' ? 'bg-slate-800 text-white border-slate-800'
                : g === 1 ? 'bg-blue-600 text-white border-blue-600'
                : g === 2 ? 'bg-green-600 text-white border-green-600'
                : 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
          )}
        >
          {g === 'all' ? '전체' : `${g}학년`}
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────
// Attendance row component
// ────────────────────────────────────────────
function AttendanceRow({ entry }: { entry: AttendanceEntry }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-slate-50 rounded-xl transition-colors">
      <div className="flex items-center gap-3">
        <span className={cn('text-xs font-bold px-2 py-1 rounded-lg border', gradeColors[entry.grade])}>
          {entry.grade}학년
        </span>
        <div>
          <p className="font-bold text-slate-800 text-sm">{entry.studentName}</p>
          <p className="text-xs text-slate-400 font-mono">{entry.studentId}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span className={cn(
          'text-xs px-2 py-1 rounded-lg font-semibold',
          entry.type === 'scan' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
        )}>
          {entry.type === 'scan' ? '바코드' : '키패드'}
        </span>
        <p className="text-xs font-mono text-slate-400 w-16 text-right">
          {entry.timestamp?.toDate ? format(entry.timestamp.toDate(), 'HH:mm:ss') : '--:--:--'}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Main Admin Page
// ────────────────────────────────────────────
export default function AdminPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [today, setToday] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // 자정에 today 자동 갱신 (관리자 패널이 밤새 열려있어도 날짜 정확)
  useEffect(() => {
    const t = setInterval(() => {
      const d = format(new Date(), 'yyyy-MM-dd');
      setToday(prev => (prev !== d ? d : prev));
    }, 10_000); // 10초마다 체크
    return () => clearInterval(t);
  }, []);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [pwChangeMsg, setPwChangeMsg] = useState('');

  // Add student form
  const [addName, setAddName] = useState('');
  const [addStudentId, setAddStudentId] = useState('');
  const [addGrade, setAddGrade] = useState('1');
  const [addClassNum, setAddClassNum] = useState('');
  const [addNumber, setAddNumber] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Year transition
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [confirmTransition, setConfirmTransition] = useState(false);

  // Secret stats overlay
  const [showSecretStats, setShowSecretStats] = useState(false);

  // Barcode management
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeStudentId, setBarcodeStudentId] = useState('');
  const [isAddingBarcode, setIsAddingBarcode] = useState(false);

  // History date range
  const [historyDate, setHistoryDate] = useState(today);

  // Ranking month — auto-advance when the real month changes
  const [rankingMonth, setRankingMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [rankingGrade, setRankingGrade] = useState<number | 'all'>('all');

  useEffect(() => {
    const sync = () => {
      const current = format(new Date(), 'yyyy-MM');
      setRankingMonth(prev => (prev < current ? current : prev));
    };
    sync();
    const t = setInterval(sync, 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Firebase queries ──
  const studentsQuery = useMemoFirebase(() => db ? collection(db, 'students') : null, [db]);
  const { data: students = [] } = useCollection<Student>(studentsQuery);

  const attendanceQuery = useMemoFirebase(
    () => today && db ? query(collection(db, 'attendance_logs'), where('date', '==', today)) : null,
    [db, today]
  );
  const { data: todayAttendance = [] } = useCollection<AttendanceEntry>(attendanceQuery);

  const historyQuery = useMemoFirebase(
    () => historyDate && db ? query(collection(db, 'attendance_logs'), where('date', '==', historyDate)) : null,
    [db, historyDate]
  );
  const { data: historyAttendance = [] } = useCollection<AttendanceEntry>(historyQuery);

  const barcodesQuery = useMemoFirebase(() => db ? collection(db, 'barcode_mappings') : null, [db]);

  type CardScan = { id: string; studentId: string; studentName: string; grade: number; point: number };
  const cardScansQuery = useMemoFirebase(
    () => rankingMonth && db ? query(collection(db, 'card_scans'), where('monthKey', '==', rankingMonth)) : null,
    [db, rankingMonth]
  );
  const { data: cardScans = [] } = useCollection<CardScan>(cardScansQuery);
  const { data: barcodes = [] } = useCollection<BarcodeMapping & { id: string }>(barcodesQuery);

  // ── Derived stats ──
  const totalStudents = students.length;
  const presentToday = todayAttendance.length;
  const absentToday = totalStudents - presentToday;
  const scanCount = todayAttendance.filter(a => a.type === 'scan').length;
  const keypadCount = todayAttendance.filter(a => a.type === 'keypad').length;
  const attendanceRate = totalStudents > 0 ? Math.round(presentToday / totalStudents * 100) : 0;

  const gradeBreakdown = [1, 2, 3].map(g => ({
    grade: g,
    total: students.filter(s => Number(s.grade) === g).length,
    present: todayAttendance.filter(a => Number(a.grade) === g).length,
  }));

  // ── 스캔 랭킹 계산 ──
  const rankingData = useMemo(() => {
    const map: Record<string, { studentId: string; name: string; grade: number; count: number }> = {};
    for (const scan of cardScans) {
      if (!map[scan.studentId]) {
        // grade를 반드시 number로 강제 변환 (Firestore 타입 불일치 방어)
        map[scan.studentId] = { studentId: scan.studentId, name: scan.studentName, grade: Number(scan.grade), count: 0 };
      }
      map[scan.studentId].count += scan.point ?? 1;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [cardScans]);

  const filteredRanking = rankingGrade === 'all'
    ? rankingData
    : rankingData.filter(r => Number(r.grade) === Number(rankingGrade));

  // ── Filtered students ──
  const filteredStudents = students
    .filter(s => gradeFilter === 'all' || Number(s.grade) === Number(gradeFilter))
    .filter(s =>
      searchQuery === '' ||
      s.name.includes(searchQuery) ||
      s.studentId.includes(searchQuery)
    )
    .sort((a, b) => a.studentId.localeCompare(b.studentId));

  // ── 1105 trigger ──
  const handlePasswordChange = () => {
    if (newPassword === '1105') {
      setShowSecretStats(true);
      setNewPassword('');
      return;
    }
    if (newPassword.length < 4) {
      setPwChangeMsg('4자 이상 입력하세요.');
      return;
    }
    localStorage.setItem(AUTH_KEY, obfuscate(newPassword));
    setPwChangeMsg('비밀번호가 변경되었습니다.');
    setNewPassword('');
    setTimeout(() => setPwChangeMsg(''), 3000);
  };

  const downloadAllAttendanceCSV = async () => {
    if (!db) return;
    try {
      const snap = await getDocs(query(collection(db, 'attendance_logs'), orderBy('date', 'desc')));
      const rows = snap.docs.map(d => {
        const data = d.data();
        return [data.date, data.studentId, data.studentName, data.grade, data.type].join(',');
      });
      const csv = ['날짜,학번,이름,학년,방식', ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_all_${format(new Date(), 'yyyyMMdd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // silent
    }
  };

  // ── Add student ──
  const handleAddStudent = async () => {
    if (!db || !addName || !addStudentId || !addGrade || !addClassNum || !addNumber) {
      toast({ title: '모든 필드를 입력하세요.', variant: 'destructive' });
      return;
    }
    if (addStudentId.length !== 5) {
      toast({ title: '학번은 5자리입니다.', variant: 'destructive' });
      return;
    }
    setIsAdding(true);
    try {
      const existing = await getDoc(doc(db, 'students', addStudentId));
      if (existing.exists()) {
        toast({ title: '이미 존재하는 학번입니다.', variant: 'destructive' });
        setIsAdding(false);
        return;
      }
      await setDoc(doc(db, 'students', addStudentId), {
        studentId: addStudentId,
        name: addName,
        grade: parseInt(addGrade),
        classNum: parseInt(addClassNum),
        number: parseInt(addNumber),
      });
      toast({ title: `${addName} 학생이 등록되었습니다.` });
      setAddName(''); setAddStudentId(''); setAddClassNum(''); setAddNumber('');
    } catch (e) {
      toast({ title: '등록 실패', variant: 'destructive' });
    }
    setIsAdding(false);
  };

  // ── Delete student ──
  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (!db) return;
    if (!window.confirm(`${name} 학생을 삭제하시겠습니까?\n출석 기록은 유지됩니다.`)) return;
    try {
      await deleteDoc(doc(db, 'students', studentId));
      toast({ title: `${name} 학생이 삭제되었습니다.` });
    } catch (e) {
      toast({ title: '삭제 실패', variant: 'destructive' });
    }
  };

  // ── Year transition (졸업/진급) ──
  const handleYearTransition = async () => {
    if (!db) return;
    setIsTransitioning(true);
    try {
      const snap = await getDocs(collection(db, 'students'));
      const allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));

      const toDelete = allStudents.filter(s => s.grade === 3);
      const toUpgrade = allStudents.filter(s => s.grade === 1 || s.grade === 2);

      const BATCH_SIZE = 400;
      const allOps = [
        ...toDelete.map(s => ({ type: 'delete' as const, student: s })),
        ...toUpgrade.map(s => ({ type: 'upgrade' as const, student: s })),
      ];

      for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
        const chunk = allOps.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const op of chunk) {
          const ref = doc(db, 'students', op.student.studentId);
          if (op.type === 'delete') {
            batch.delete(ref);
          } else {
            batch.update(ref, { grade: op.student.grade + 1 });
          }
        }
        await batch.commit();
      }

      toast({
        title: '학년 전환 완료',
        description: `3학년 ${toDelete.length}명 졸업, 1·2학년 ${toUpgrade.length}명 진급`,
      });
      setConfirmTransition(false);
    } catch (e) {
      toast({ title: '학년 전환 실패', variant: 'destructive' });
    }
    setIsTransitioning(false);
  };

  // ── Export today CSV ──
  const exportTodayCSV = () => {
    const rows = todayAttendance.map(e =>
      [e.date, e.studentId, e.studentName, e.grade, e.type].join(',')
    );
    const csv = ['날짜,학번,이름,학년,방식', ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Barcode add ──
  const handleAddBarcode = async () => {
    if (!db || !barcodeInput || !barcodeStudentId) {
      toast({ title: '바코드와 학번을 입력하세요.', variant: 'destructive' });
      return;
    }
    setIsAddingBarcode(true);
    try {
      await setDoc(doc(db, 'barcode_mappings', barcodeInput), {
        barcode: barcodeInput,
        studentId: barcodeStudentId,
      });
      toast({ title: '바코드 등록 완료' });
      setBarcodeInput(''); setBarcodeStudentId('');
    } catch {
      toast({ title: '등록 실패', variant: 'destructive' });
    }
    setIsAddingBarcode(false);
  };

  const handleDeleteBarcode = async (id: string) => {
    if (!db) return;
    if (!window.confirm('바코드 매핑을 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'barcode_mappings', id));
      toast({ title: '삭제 완료' });
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' });
    }
  };

  // ── Auth gate ──
  if (!isAuthenticated) {
    return (
      <LoginScreen onLogin={async () => {
        setIsAuthenticated(true);
        if (db) {
          try {
            const { addDoc, collection: col } = await import('firebase/firestore');
            await addDoc(col(db, 'admin_logs'), {
              timestamp: new Date().toISOString(),
              action: 'login',
            });
          } catch {}
        }
      }} />
    );
  }

  // ── Secret stats overlay ──
  if (showSecretStats) {
    return <SecretStats db={db} onClose={() => setShowSecretStats(false)} />;
  }

  // ── Sidebar nav items ──
  const navItems: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'attendance', label: '출석 현황', icon: LayoutDashboard, badge: presentToday },
    { key: 'ranking', label: '월간 랭킹', icon: Trophy },
    { key: 'history', label: '출석 이력', icon: History },
    { key: 'students', label: '학생 관리', icon: Users, badge: totalStudents },
    { key: 'barcode', label: '바코드 관리', icon: ScanBarcode, badge: barcodes.length },
    { key: 'settings', label: '비번 변경', icon: Shield },
    { key: 'guide', label: '운용 가이드', icon: BookMarked },
    { key: 'contact', label: '문의', icon: MessageCircle },
  ];

  const activeTabLabel = navItems.find(n => n.key === activeTab)?.label ?? '';

  // ────────────────────────────────────────────
  // Authenticated admin UI
  // ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">

      {/* ── Sidebar ── */}
      <aside className="w-52 shrink-0 bg-slate-900 min-h-screen flex flex-col fixed top-0 left-0 z-20">
        {/* Logo */}
        <div className="px-4 pt-6 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#2672D9] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0">H</div>
            <div className="min-w-0">
              <p className="text-white font-black text-sm truncate">효명고</p>
              <p className="text-slate-500 text-xs truncate">야간자율학습 관리</p>
            </div>
          </div>
        </div>

        {/* Today summary */}
        <div className="px-4 py-4 border-b border-slate-800">
          <p className="text-slate-500 text-xs font-medium mb-2">
            {format(new Date(), 'M월 d일 (EEE)', { locale: ko })}
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">출석</span>
              <span className="text-emerald-400 text-xs font-black">{presentToday}명</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">미출석</span>
              <span className="text-red-400 text-xs font-black">{absentToday}명</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
            <p className="text-slate-500 text-xs text-right">{attendanceRate}%</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
                activeTab === key
                  ? 'bg-[#2672D9] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </div>
              {badge !== undefined && (
                <span className={cn(
                  'text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums',
                  activeTab === key ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                )}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 pb-4 space-y-0.5 border-t border-slate-800 pt-3">
          <Link href="/" className="block">
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
              <ChevronLeft className="w-4 h-4" />
              <span>메인으로</span>
            </button>
          </Link>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="ml-52 flex-1 min-h-screen flex flex-col">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-800">{activeTabLabel}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {format(new Date(), 'yyyy년 M월 d일 EEEE', { locale: ko })}
              </p>
            </div>
            {/* Tab-specific header actions */}
            {activeTab === 'attendance' && (
              <Button onClick={exportTodayCSV} variant="outline" size="sm" className="rounded-xl gap-2">
                <Download className="w-4 h-4" /> CSV 내보내기
              </Button>
            )}
            {activeTab === 'history' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={historyDate}
                  onChange={e => setHistoryDate(e.target.value)}
                  className="border-2 border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#2672D9]"
                />
                <Button
                  onClick={() => {
                    const rows = historyAttendance.map(e =>
                      [e.date, e.studentId, e.studentName, e.grade, e.type].join(',')
                    );
                    const csv = ['날짜,학번,이름,학년,방식', ...rows].join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `attendance_${historyDate}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Stats strip (출석 현황/이력 탭에서만 표시) */}
        {(activeTab === 'attendance' || activeTab === 'history') && (
          <div className="bg-white border-b border-slate-100 px-8 py-3">
            <div className="flex flex-wrap gap-2">
              <StatPill label="총 학생" value={totalStudents} accent="bg-slate-400" />
              <StatPill label="오늘 출석" value={presentToday} accent="bg-emerald-500" />
              <StatPill label="미출석" value={absentToday} accent="bg-red-400" />
              <StatPill label="바코드 스캔" value={scanCount} unit="건" accent="bg-blue-500" />
              <StatPill label="키패드 입력" value={keypadCount} unit="건" accent="bg-slate-400" />
              {/* Grade breakdown inline */}
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
                {gradeBreakdown.map(({ grade, total, present }) => (
                  <div key={grade} className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl',
                    grade === 1 ? 'bg-blue-50' : grade === 2 ? 'bg-green-50' : 'bg-orange-50'
                  )}>
                    <span className={cn('text-xs font-black px-1.5 py-0.5 rounded-md border', gradeColors[grade])}>
                      {grade}학년
                    </span>
                    <span className="text-sm font-black text-slate-700">{present}</span>
                    <span className="text-xs text-slate-400">/{total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 p-8">

          {/* ── Tab: 출석 현황 ── */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {/* Grade filter */}
              <div className="flex items-center justify-between">
                <GradeFilter value={gradeFilter} onChange={setGradeFilter} />
                <p className="text-sm text-slate-400">
                  {gradeFilter === 'all' ? `전체 ${presentToday}명 출석` : `${gradeFilter}학년 ${todayAttendance.filter(e => e.grade === gradeFilter).length}명 출석`}
                </p>
              </div>

              {/* Present */}
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="pb-2 pt-5 px-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <CardTitle className="text-sm font-black text-slate-600">
                      출석 완료
                      <span className="ml-2 text-emerald-600">
                        {todayAttendance.filter(e => gradeFilter === 'all' || Number(e.grade) === Number(gradeFilter)).length}명
                      </span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  {todayAttendance
                    .filter(e => gradeFilter === 'all' || Number(e.grade) === Number(gradeFilter))
                    .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0))
                    .map(entry => <AttendanceRow key={entry.id} entry={entry} />)}
                  {todayAttendance.filter(e => gradeFilter === 'all' || Number(e.grade) === Number(gradeFilter)).length === 0 && (
                    <p className="text-center text-slate-400 py-10 text-sm">아직 출석한 학생이 없습니다.</p>
                  )}
                </CardContent>
              </Card>

              {/* Absent */}
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="pb-2 pt-5 px-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                    <CardTitle className="text-sm font-black text-slate-600">
                      미출석
                      <span className="ml-2 text-red-500">
                        {students.filter(s => (gradeFilter === 'all' || Number(s.grade) === Number(gradeFilter)) && !todayAttendance.some(a => a.studentId === s.studentId)).length}명
                      </span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  {students
                    .filter(s => (gradeFilter === 'all' || Number(s.grade) === Number(gradeFilter)) && !todayAttendance.some(a => a.studentId === s.studentId))
                    .sort((a, b) => a.studentId.localeCompare(b.studentId))
                    .map(s => (
                      <div key={s.id} className="flex items-center justify-between py-3 px-4 opacity-50 hover:opacity-70 rounded-xl transition-opacity">
                        <div className="flex items-center gap-3">
                          <span className={cn('text-xs font-bold px-2 py-1 rounded-lg border', gradeColors[s.grade])}>
                            {s.grade}학년
                          </span>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{s.studentId}</p>
                          </div>
                        </div>
                        <span className="text-xs text-red-400 font-bold">미출석</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Tab: 스캔 랭킹 ── */}
          {activeTab === 'ranking' && (
            <div className="space-y-5">
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-slate-700">월간 랭킹</span>
                </div>
                <input
                  type="month"
                  value={rankingMonth}
                  onChange={e => setRankingMonth(e.target.value)}
                  className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2672D9] bg-white"
                />
                <GradeFilter value={rankingGrade} onChange={setRankingGrade} />
                <span className="ml-auto text-sm text-slate-400 font-medium">{filteredRanking.length}명 참여</span>
              </div>

              {/* Top 3 podium */}
              {filteredRanking.length >= 3 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { rank: 2, medal: '🥈', bg: 'bg-white', border: 'border-slate-200', textColor: 'text-slate-600', offset: 'mt-6' },
                    { rank: 1, medal: '🥇', bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-700', offset: '' },
                    { rank: 3, medal: '🥉', bg: 'bg-white', border: 'border-orange-200', textColor: 'text-orange-600', offset: 'mt-10' },
                  ].map(({ rank, medal, bg, border, textColor, offset }) => {
                    const entry = filteredRanking[rank - 1];
                    return (
                      <Card key={rank} className={cn('border shadow-sm text-center', bg, border, offset)}>
                        <CardContent className="p-6">
                          <div className="text-4xl mb-3">{medal}</div>
                          <p className="font-black text-slate-800 text-lg">{entry.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">{entry.studentId}</p>
                          <span className={cn('text-xs font-bold px-2 py-1 rounded-lg mt-2 inline-block border', gradeColors[entry.grade])}>
                            {entry.grade}학년
                          </span>
                          <p className={cn('text-3xl font-black mt-4', textColor)}>
                            {entry.count}<span className="text-sm font-medium text-slate-400 ml-1">회</span>
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Full ranking list */}
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="pb-2 pt-5 px-6">
                  <CardTitle className="text-sm font-black text-slate-600">전체 순위</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  {filteredRanking.length === 0 && (
                    <p className="text-center text-slate-400 py-12 text-sm">해당 월 바코드 스캔 기록이 없습니다.</p>
                  )}
                  {filteredRanking.map((entry, i) => (
                    <div key={entry.studentId} className={cn(
                      'flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors',
                      i < 3 && 'bg-amber-50/40 hover:bg-amber-50'
                    )}>
                      <div className="w-8 text-center shrink-0">
                        {i === 0 ? <span className="text-xl">🥇</span>
                          : i === 1 ? <span className="text-xl">🥈</span>
                          : i === 2 ? <span className="text-xl">🥉</span>
                          : <span className="text-sm font-bold text-slate-400 tabular-nums">{i + 1}</span>}
                      </div>
                      <span className={cn('text-xs font-bold px-2 py-1 rounded-lg border shrink-0', gradeColors[entry.grade])}>
                        {entry.grade}학년
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm">{entry.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{entry.studentId}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-[#2672D9]">{entry.count}</p>
                        <p className="text-xs text-slate-400">회 스캔</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Tab: 출석 이력 ── */}
          {activeTab === 'history' && (
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pt-5 px-6 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-black text-slate-600">
                    {historyDate} 출석: <span className="text-[#2672D9]">{historyAttendance.length}명</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                {historyAttendance
                  .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0))
                  .map(entry => <AttendanceRow key={entry.id} entry={entry} />)}
                {historyAttendance.length === 0 && (
                  <p className="text-center text-slate-400 py-12 text-sm">해당 날짜의 출석 기록이 없습니다.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Tab: 학생 관리 ── */}
          {activeTab === 'students' && (
            <div className="space-y-5">
              {/* Add student form */}
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="pt-5 px-6 pb-3">
                  <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> 학생 추가
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <input
                      value={addStudentId}
                      onChange={e => setAddStudentId(e.target.value)}
                      placeholder="학번 (5자리)"
                      maxLength={5}
                      className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2672D9] font-mono"
                    />
                    <input
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      placeholder="이름"
                      className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2672D9]"
                    />
                    <select
                      value={addGrade}
                      onChange={e => setAddGrade(e.target.value)}
                      className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2672D9]"
                    >
                      <option value="1">1학년</option>
                      <option value="2">2학년</option>
                      <option value="3">3학년</option>
                    </select>
                    <input
                      value={addClassNum}
                      onChange={e => setAddClassNum(e.target.value)}
                      placeholder="반"
                      type="number"
                      className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2672D9]"
                    />
                    <input
                      value={addNumber}
                      onChange={e => setAddNumber(e.target.value)}
                      placeholder="번호"
                      type="number"
                      className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2672D9]"
                    />
                  </div>
                  <Button
                    onClick={handleAddStudent}
                    disabled={isAdding}
                    className="mt-4 bg-[#2672D9] rounded-xl gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {isAdding ? '등록 중...' : '학생 등록'}
                  </Button>
                </CardContent>
              </Card>

              {/* Student list */}
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="pt-5 px-6 pb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <CardTitle className="text-sm font-black text-slate-700">
                      학생 목록 <span className="text-[#2672D9]">{filteredStudents.length}명</span>
                    </CardTitle>
                    <GradeFilter value={gradeFilter} onChange={setGradeFilter} />
                  </div>
                  <div className="relative mt-3">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="이름 또는 학번으로 검색"
                      className="w-full border-2 border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#2672D9]"
                    />
                  </div>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  {filteredStudents.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className={cn('text-xs font-bold px-2 py-1 rounded-lg border', gradeColors[s.grade])}>
                          {s.grade}학년 {s.classNum}반 {s.number}번
                        </span>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{s.studentId}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteStudent(s.studentId, s.name)}
                        className="p-2 text-slate-200 group-hover:text-slate-300 hover:!text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {filteredStudents.length === 0 && (
                    <p className="text-center text-slate-400 py-10 text-sm">학생이 없습니다.</p>
                  )}
                </CardContent>
              </Card>

              {/* Danger zone: Year transition + password change */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Year transition */}
                <Card className="border border-red-200 bg-red-50/50">
                  <CardContent className="p-6">
                    <h3 className="font-black text-red-700 text-sm flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" /> 학년 전환
                    </h3>
                    <p className="text-xs text-red-500/80 mb-4 leading-relaxed">
                      3학년 졸업 삭제, 1·2학년 자동 진급.<br />
                      <strong>되돌릴 수 없습니다.</strong>
                    </p>
                    {!confirmTransition ? (
                      <Button
                        onClick={() => setConfirmTransition(true)}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-100 rounded-xl text-sm"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" /> 학년 전환 실행
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleYearTransition}
                          disabled={isTransitioning}
                          className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm"
                        >
                          {isTransitioning ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                          정말로 실행
                        </Button>
                        <Button onClick={() => setConfirmTransition(false)} variant="outline" className="rounded-xl text-sm">
                          취소
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            </div>
          )}

          {/* ── Tab: 바코드 관리 ── */}
          {activeTab === 'barcode' && (
            <div className="space-y-5">
              {/* Add barcode */}
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="pt-5 px-6 pb-3">
                  <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> 바코드 매핑 추가
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5">
                  <div className="flex gap-3">
                    <input
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value.toUpperCase())}
                      placeholder="바코드 값 (예: 1234A)"
                      className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2672D9] font-mono uppercase"
                    />
                    <input
                      value={barcodeStudentId}
                      onChange={e => setBarcodeStudentId(e.target.value)}
                      placeholder="학번 (5자리)"
                      maxLength={5}
                      className="w-36 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2672D9] font-mono"
                    />
                    <Button
                      onClick={handleAddBarcode}
                      disabled={isAddingBarcode}
                      className="bg-[#2672D9] rounded-xl gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {isAddingBarcode ? '등록 중...' : '등록'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    학생증 바코드를 스캔하면 자동으로 학번으로 변환됩니다.
                  </p>
                </CardContent>
              </Card>

              {/* Barcode list */}
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="pt-5 px-6 pb-2">
                  <CardTitle className="text-sm font-black text-slate-700">
                    등록된 바코드 <span className="text-[#2672D9]">{barcodes.length}개</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  {barcodes.map(bc => {
                    const student = students.find(s => s.studentId === bc.studentId);
                    return (
                      <div key={bc.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                            <ScanBarcode className="w-5 h-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-black font-mono text-slate-800 text-sm">{bc.barcode ?? bc.id}</p>
                            <p className="text-xs text-slate-400">
                              {bc.studentId}
                              {student ? (
                                <span className={cn('ml-2 px-1.5 py-0.5 rounded-md font-bold border', gradeColors[student.grade])}>
                                  {student.name}
                                </span>
                              ) : (
                                <span className="ml-2 text-red-400">(학생 없음)</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteBarcode(bc.id)}
                          className="p-2 text-slate-200 group-hover:text-slate-300 hover:!text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  {barcodes.length === 0 && (
                    <p className="text-center text-slate-400 py-10 text-sm">등록된 바코드가 없습니다.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Tab: 비번 변경 (설정) ── */}
          {activeTab === 'settings' && (
            <div className="max-w-md space-y-4">
              {/* 비밀번호 변경 */}
              <Card className="border border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Shield className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm">비밀번호 변경</h3>
                      <p className="text-xs text-slate-400">4자 이상 입력하세요</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handlePasswordChange()}
                      placeholder="새 비밀번호 입력"
                      className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2672D9]"
                      autoComplete="new-password"
                      name="new-admin-pw"
                      autoFocus
                    />
                    <Button onClick={handlePasswordChange} className="bg-slate-800 hover:bg-slate-900 rounded-xl text-sm px-5">
                      변경
                    </Button>
                  </div>
                  {pwChangeMsg && (
                    <p className="text-xs text-emerald-600 mt-2 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                      {pwChangeMsg}
                    </p>
                  )}
                  <p className="text-xs text-slate-300 mt-4 pt-4 border-t border-slate-100">
                    특정 코드 입력 시 고급 기능에 접근할 수 있습니다.
                  </p>
                </CardContent>
              </Card>

              {/* 현재 비번 정보 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 font-medium">
                  기본 비밀번호: <span className="text-slate-600 font-bold">admin1234</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  변경 후 브라우저 localStorage에 암호화 저장됩니다.
                </p>
              </div>
            </div>
          )}

          {/* ── Tab: 운용 가이드 ── */}
          {activeTab === 'guide' && (
            <div className="max-w-3xl space-y-6 pb-10">

              {/* 안내 배너 */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <p className="text-slate-700 text-sm leading-relaxed font-medium">
                  📋 이 가이드는 <strong>처음 사용하시는 선생님</strong>을 위해 작성되었습니다. 순서대로 따라하시면 누구나 쉽게 운용하실 수 있습니다.
                </p>
                <p className="text-xs text-slate-400 mt-2">현재 BETA 버전입니다. 문의사항은 개발 담당 학생에게 연락주세요.</p>
              </div>

              {/* STEP 1 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-800 px-5 py-3 flex items-center gap-3">
                  <span className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0">1</span>
                  <div>
                    <span className="text-white font-bold text-sm">처음 시작할 때 — 학생 등록하기</span>
                    <span className="ml-2 text-xs text-slate-400">최초 1회만 진행</span>
                  </div>
                </div>
                <div className="p-5 space-y-4 text-sm text-slate-600">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-xs">
                    ⚠️ 학생을 먼저 등록해야 출석 체크가 가능합니다. 등록되지 않은 학생은 출석해도 "미등록 학생"으로 표시됩니다.
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">①</span>
                      <div><span className="font-bold text-slate-700">왼쪽 메뉴에서 "학생 관리"</span> 탭을 클릭합니다.</div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">②</span>
                      <div>
                        <span className="font-bold text-slate-700">"학생 추가" 버튼</span>을 눌러 학번·이름·학년·반·번호를 입력합니다.
                        <div className="mt-1 bg-slate-50 rounded-lg p-2 text-xs text-slate-500">
                          💡 학번 형식: <strong>학년+반+번호</strong> (예: 3학년 7반 2번 → <strong>30702</strong>)
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">③</span>
                      <div>학생 수가 많은 경우 <span className="font-bold text-slate-700">"CSV 일괄 등록"</span> 기능을 이용하면 엑셀 파일로 한 번에 등록 가능합니다. (개발 담당 학생에게 CSV 파일 형식 문의)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-800 px-5 py-3 flex items-center gap-3">
                  <span className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0">2</span>
                  <div>
                    <span className="text-white font-bold text-sm">처음 시작할 때 — 바코드 연결하기</span>
                    <span className="ml-2 text-xs text-slate-400">학생증 바코드 스캔을 사용할 경우</span>
                  </div>
                </div>
                <div className="p-5 space-y-4 text-sm text-slate-600">
                  <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                    💡 학번 키패드만 사용하실 경우 이 단계는 건너뛰어도 됩니다. 바코드 스캔을 원하시면 아래를 따라해 주세요.
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">①</span>
                      <div>왼쪽 메뉴에서 <span className="font-bold text-slate-700">"바코드 관리"</span> 탭을 클릭합니다.</div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">②</span>
                      <div>
                        <span className="font-bold text-slate-700">학생증 바코드 값</span>과 <span className="font-bold text-slate-700">학번</span>을 입력하고 등록합니다.
                        <div className="mt-1 bg-slate-50 rounded-lg p-2 text-xs text-slate-500">
                          💡 바코드 값을 모르는 경우: 메인 화면에서 "스캔 ON" 버튼을 켜고 학생증을 비추면 자동으로 바코드 값이 감지됩니다. 그 값을 여기에 입력하면 됩니다.
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">③</span>
                      <div>등록 후에는 해당 학생의 학생증을 스캔하면 자동으로 출석이 처리됩니다.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-800 px-5 py-3 flex items-center gap-3">
                  <span className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0">3</span>
                  <div>
                    <span className="text-white font-bold text-sm">매일 야자 시간 운용 방법</span>
                    <span className="ml-2 text-xs text-slate-400">날마다 반복</span>
                  </div>
                </div>
                <div className="p-5 space-y-4 text-sm text-slate-600">
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">①</span>
                      <div>야자 시작 전, 도서관 컴퓨터나 태블릿에서 <span className="font-bold text-slate-700">메인 화면(출석 체크)</span>을 열어 놓습니다. 주소창에 사이트 주소를 입력하거나 즐겨찾기로 저장해두세요.</div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">②</span>
                      <div>
                        학생이 도착하면 두 가지 방법 중 하나로 출석합니다.
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <p className="font-bold text-blue-700 text-xs mb-1">📷 바코드 스캔</p>
                            <p className="text-xs text-slate-500">"스캔 ON" 버튼 → 학생증 뒷면 바코드를 카메라에 비추기</p>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="font-bold text-slate-700 text-xs mb-1">🔢 학번 입력</p>
                            <p className="text-xs text-slate-500">화면 키패드로 5자리 학번 직접 입력</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">③</span>
                      <div>출석 완료 시 화면에 <span className="font-bold text-green-600">✅ 출석 완료</span> 메시지와 학생 이름이 표시됩니다. 이름이 맞는지 학생이 직접 확인하도록 안내하세요.</div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">④</span>
                      <div><span className="font-bold text-slate-700">날짜가 바뀌면 자동으로 초기화</span>됩니다. 매일 별도로 리셋할 필요가 없으며, 자정이 지나면 새로운 날의 출석으로 자동 전환됩니다.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 4 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-800 px-5 py-3 flex items-center gap-3">
                  <span className="w-7 h-7 bg-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0">4</span>
                  <span className="text-white font-bold text-sm">출석 현황 확인 및 출석부 출력</span>
                </div>
                <div className="p-5 space-y-4 text-sm text-slate-600">
                  <div className="space-y-4">
                    <div>
                      <p className="font-bold text-slate-700 mb-2">📊 오늘 출석 현황 보기</p>
                      <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs text-slate-500">
                        <p>왼쪽 메뉴 <strong>"출석 현황"</strong> 클릭 → 오늘 출석한 학생 전체 목록이 표시됩니다.</p>
                        <p>상단 <strong>"1학년 / 2학년 / 3학년"</strong> 버튼으로 학년별로 필터링할 수 있습니다.</p>
                        <p>우측 상단 <strong>"CSV 내보내기"</strong> 버튼을 누르면 엑셀로 저장할 수 있습니다.</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 mb-2">📅 과거 날짜 출석 기록 보기</p>
                      <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs text-slate-500">
                        <p>왼쪽 메뉴 <strong>"출석 이력"</strong> 클릭 → 날짜 선택기에서 원하는 날짜를 선택합니다.</p>
                        <p>해당 날짜의 전체 출석 기록이 표시됩니다. 바코드/키패드 구분도 확인 가능합니다.</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 mb-2">🏆 월간 랭킹 보기</p>
                      <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs text-slate-500">
                        <p>왼쪽 메뉴 <strong>"월간 랭킹"</strong> 클릭 → 이번 달 바코드 스캔 횟수 기준 랭킹이 표시됩니다.</p>
                        <p>달이 바뀌면 자동으로 해당 월 랭킹으로 전환됩니다.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 5 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-800 px-5 py-3 flex items-center gap-3">
                  <span className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0">5</span>
                  <span className="text-white font-bold text-sm">비밀번호 관리 및 보안 주의사항</span>
                </div>
                <div className="p-5 space-y-3 text-sm text-slate-600">
                  <div className="flex gap-3 items-start">
                    <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">①</span>
                    <div><span className="font-bold text-slate-700">비밀번호 변경:</span> 왼쪽 메뉴 "비번 변경" 탭에서 새 비밀번호를 입력하고 변경 버튼을 누르면 됩니다. 초기 비밀번호(admin1234)는 반드시 변경해 주세요.</div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">②</span>
                    <div><span className="font-bold text-slate-700">로그인 잠금:</span> 비밀번호를 10회 연속 틀리면 1분간 잠금됩니다. 잠금 화면에서 해제 키를 입력하면 즉시 해제됩니다. (해제 키는 개발 담당 학생에게 문의)</div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">③</span>
                    <div><span className="font-bold text-slate-700">자리를 비울 때:</span> 왼쪽 하단 "로그아웃" 버튼을 눌러주세요. 학생이 관리자 페이지에 접근하지 못하도록 반드시 로그아웃 후 자리를 비워주세요.</div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">④</span>
                    <div><span className="font-bold text-slate-700">브라우저 비밀번호 저장 금지:</span> 브라우저가 "비밀번호 저장할까요?" 라고 물어보면 반드시 <strong>"저장 안 함"</strong>을 선택하세요. 다른 사람이 같은 기기를 사용할 수 있습니다.</div>
                  </div>
                </div>
              </div>

              {/* STEP 6 - FAQ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-800 px-5 py-3 flex items-center gap-3">
                  <span className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0">?</span>
                  <span className="text-white font-bold text-sm">문제가 생겼을 때 — 자주 묻는 질문</span>
                </div>
                <div className="p-5 space-y-3 text-sm">
                  {[
                    {
                      q: '학생증을 카메라에 비추는데 인식이 안 돼요',
                      a: '학생증 뒷면(바코드가 있는 면)을 카메라에 비춰주세요. 앞면(사진 있는 면)은 인식되지 않습니다. 빛 반사가 심할 경우 각도를 조금 바꿔보세요. 그래도 안 된다면 학번을 직접 키패드로 입력하면 됩니다.',
                    },
                    {
                      q: '학생이 출석했는데 "미등록 학생"이라고 나와요',
                      a: '"학생 관리" 탭에서 해당 학번이 등록되어 있는지 확인하세요. 바코드로 출석한 경우에는 "바코드 관리" 탭에서 해당 학생증 바코드가 등록되어 있는지도 확인해 주세요.',
                    },
                    {
                      q: '출석했다고 했는데 출석 현황에 이름이 안 보여요',
                      a: '화면 상단의 학년 필터가 특정 학년으로 선택되어 있을 수 있습니다. "전체"를 선택해서 다시 확인해 보세요. 그래도 없으면 페이지를 새로 고침(F5 또는 브라우저 새로고침 버튼)해 주세요.',
                    },
                    {
                      q: '"이미 출석하셨습니다"라고 나오는데 실제로 안 했어요',
                      a: '오늘 날짜에 이미 동일한 학번으로 출석 기록이 있는 경우입니다. "출석 이력" 탭에서 오늘 날짜를 선택해 중복 기록이 있는지 확인해 주세요.',
                    },
                    {
                      q: '카메라 화면이 아예 안 켜져요',
                      a: '주소창을 확인해 주세요. 주소가 http://로 시작하면 카메라가 작동하지 않습니다. 반드시 https://로 시작하는 주소로 접속해야 합니다. 또한 브라우저에서 카메라 사용 허용을 눌러주셔야 합니다. 주소창 왼쪽의 자물쇠 아이콘을 클릭하면 권한 설정이 가능합니다.',
                    },
                    {
                      q: '출석 데이터가 갑자기 없어진 것 같아요',
                      a: '모든 데이터는 인터넷 서버(클라우드)에 안전하게 저장되므로 실제로 사라지지 않습니다. 날짜 필터나 학년 필터를 확인해 보세요. 인터넷 연결이 일시적으로 끊겼을 경우 잠시 후 새로고침하면 정상적으로 표시됩니다.',
                    },
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                      <p className="font-bold text-slate-700 mb-1.5 flex items-start gap-2"><span className="text-amber-500 shrink-0">Q.</span>{item.q}</p>
                      <p className="text-slate-500 leading-relaxed flex items-start gap-2"><span className="text-blue-500 font-bold shrink-0">A.</span>{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* 문의 탭 */}
          {activeTab === 'contact' && (
            <div className="p-6 max-w-lg mx-auto space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">문의하기</h2>
                <p className="text-sm text-slate-500 mt-1">오류 신고, 기능 요청, 사용 문의는 아래로 연락해 주세요.</p>
              </div>

              {/* 개발 담당 카드 */}
              <div className="border border-slate-200 rounded-2xl p-5 flex items-center gap-4 bg-white shadow-sm">
                <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0">차</div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-base">차진헌</p>
                  <p className="text-xs text-slate-400 mt-0.5">개발 담당</p>
                  <div className="flex flex-col gap-1.5 mt-3">
                    <a
                      href="mailto:24293@hmh.or.kr"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-xl transition-colors"
                    >
                      <MessageCircle size={14} />
                      24293@hmh.or.kr (Google Chat)
                    </a>
                    <a
                      href="mailto:24293@hmh.or.kr"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl transition-colors"
                    >
                      <span className="text-xs">✉</span>
                      이메일로 문의
                    </a>
                  </div>
                </div>
              </div>

              {/* 안내 */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700 space-y-1">
                <p className="font-bold">문의 시 이런 내용을 포함해 주세요</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-amber-600 mt-2">
                  <li>오류가 발생한 상황 (어떤 동작 중에 발생했는지)</li>
                  <li>오류 메시지 또는 화면 캡처</li>
                  <li>사용 중인 기기 (PC / 태블릿 / 스마트폰)</li>
                </ul>
              </div>

              {/* 학생 안내문 */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-700 text-sm">📄 학생용 이용 안내문 인쇄</p>
                  <p className="text-xs text-slate-500 mt-0.5">코팅 후 게시용 A4 안내문입니다. 학생들이 잘 볼 수 있는 곳에 부착해 주세요.</p>
                </div>
                <a href="/guide" target="_blank" className="px-4 py-2 bg-[#2672D9] text-white text-xs font-bold rounded-xl hover:bg-[#1e5bb8] transition-colors whitespace-nowrap">
                  안내문 열기 →
                </a>
              </div>

              <p className="text-xs text-slate-400 text-center">현재 BETA 버전입니다 · 빠른 시일 내에 답변 드리겠습니다</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
