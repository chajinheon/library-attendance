"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Student, AttendanceEntry } from '@/lib/types';
import { Settings, Users, ScanBarcode, UserCheck, StopCircle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { syncToNotion } from './actions/sync-notion';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode } from 'html5-qrcode';
import { cn } from '@/lib/utils';
import { AttendanceRoster } from '@/components/AttendanceRoster';
import { normalizeBarcodeValue } from '@/lib/barcode-utils';
import { dailyBackupToNotion } from '@/lib/daily-backup';

export default function Home() {
  const db = useFirestore();
  const { toast } = useToast();

  const [today, setToday] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [currentMonthDisplay, setCurrentMonthDisplay] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'warning' | 'loading', message: string, name?: string }>({
    type: 'idle', message: '학번 입력 또는 바코드를 스캔하세요'
  });

  // ── 추가 state ──
  const [isOnline, setIsOnline] = useState(true);
  const [checkInOverlay, setCheckInOverlay] = useState<{ name: string; grade: number; classNum: number; num: number } | null>(null);

  const isProcessingRef = useRef(false);
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const tick = () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      setCurrentTime(now);
      if (todayStr !== today) {
        setToday(todayStr);
        setCurrentMonth(format(now, 'yyyy-MM'));
        setCurrentMonthDisplay(`${now.getMonth() + 1}월`);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [today]);

  // ── 오프라인 감지 ──
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── 30초 비활성 자동 초기화 ──
  useEffect(() => {
    if (isScannerActive) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setInput('');
      setStatus({ type: 'idle', message: '학번 입력 또는 바코드를 스캔하세요' });
    }, 30000);
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [input, isScannerActive]);

  const studentsQuery = useMemoFirebase(() => db ? collection(db, 'students') : null, [db]);
  const { data: dbStudents = [] } = useCollection<Student>(studentsQuery);

  const attendanceQuery = useMemoFirebase(() => today && db ? query(collection(db, 'attendance_logs'), where('date', '==', today)) : null, [db, today]);
  const { data: attendance = [] } = useCollection<AttendanceEntry>(attendanceQuery);

  const processCheckIn = async (rawInput: string, isFromScanner: boolean) => {
    if (isProcessingRef.current || !db || !today) return;
    isProcessingRef.current = true;
    setStatus({ type: 'loading', message: '정보 확인 중...' });

    try {
      const normalized = isFromScanner ? normalizeBarcodeValue(rawInput) : rawInput.trim();
      let studentId = normalized;

      if (isFromScanner) {
        const mappingSnap = await getDoc(doc(db, 'barcode_mappings', normalized));
        if (mappingSnap.exists()) studentId = mappingSnap.data().studentId;
      }

      let student = dbStudents.find(s => s.studentId === studentId);
      if (!student) {
        const snap = await getDoc(doc(db, 'students', studentId));
        if (snap.exists()) student = { ...snap.data(), id: snap.id } as Student;
      }

      if (!student) {
        setStatus({ type: 'error', message: '미등록 학생입니다.' });
      } else {
        const dedupeKey = `${student.studentId}_${today}`;
        const existing = await getDoc(doc(db, 'attendance_logs', dedupeKey));
        if (existing.exists()) {
          setStatus({ type: 'warning', message: '이미 출석 완료되었습니다.', name: student.name });
        } else {
          const batch = writeBatch(db);
          batch.set(doc(db, 'attendance_logs', dedupeKey), {
            id: dedupeKey, studentId: student.studentId, studentName: student.name,
            timestamp: serverTimestamp(), date: today, grade: student.grade, type: isFromScanner ? 'scan' : 'keypad'
          });
          if (isFromScanner) {
            batch.set(doc(db, 'card_scans', dedupeKey), {
              id: dedupeKey, rawCode: normalized, studentId: student.studentId,
              studentName: student.name, timestamp: serverTimestamp(), date: today,
              monthKey: currentMonth, grade: student.grade, point: 1
            });
          }
          await batch.commit();

          syncToNotion({
            studentId: student.studentId, studentName: student.name, grade: student.grade,
            date: today, monthKey: currentMonth, monthDisplay: currentMonthDisplay, isCardScan: isFromScanner
          });

          const backupKey = `backup_${today}`;
          if (!localStorage.getItem(backupKey)) {
            dailyBackupToNotion(db).then(() => localStorage.setItem(backupKey, 'done'));
          }

          setStatus({ type: 'success', message: `${student.name}님, 체크인 완료!`, name: student.name });

          // ── 체크인 완료 오버레이 (3초) ──
          const classNum = parseInt(student.studentId.slice(1, 3));
          const num = parseInt(student.studentId.slice(3, 5));
          setCheckInOverlay({ name: student.name, grade: student.grade, classNum, num });
          setTimeout(() => setCheckInOverlay(null), 3000);
        }
      }
    } catch (err: any) {
      console.error('[processCheckIn] error:', err);
      setStatus({ type: 'error', message: '네트워크 오류가 발생했습니다. 다시 시도해주세요.' });
    } finally {
      setTimeout(() => {
        if (!isFromScanner) setInput('');
        setStatus({ type: 'idle', message: '학번 입력 또는 바코드를 스캔하세요' });
        isProcessingRef.current = false;
      }, 2500);
    }
  };

  useEffect(() => {
    if (input.length === 5) processCheckIn(input, false);
  }, [input]);

  useEffect(() => {
    if (isScannerActive) {
      const html5QrCode = new Html5Qrcode("qr-reader", { verbose: false });
      scannerInstanceRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: "user" },
        { fps: 10, qrbox: { width: 400, height: 150 } },
        (t) => processCheckIn(t, true),
        (errMsg) => {
          if (errMsg?.includes('NotAllowedError') || errMsg?.includes('Permission') || errMsg?.includes('permission')) {
            setStatus({ type: 'error', message: '카메라 접근이 거부됐습니다. 브라우저 주소창 옆 카메라 아이콘을 확인하세요.' });
            setIsScannerActive(false);
          }
        }
      ).catch((err: any) => {
        console.error('[Scanner] start failed:', err);
        setStatus({ type: 'error', message: '카메라를 시작할 수 없습니다. 권한을 확인하세요.' });
        setIsScannerActive(false);
      });
    }
    return () => { if (scannerInstanceRef.current?.isScanning) scannerInstanceRef.current.stop(); };
  }, [isScannerActive]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col p-4 md:p-8 space-y-6">

      {/* ── 오프라인 배너 ── */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-3 font-black text-sm flex items-center justify-center gap-2 shadow-lg">
          ⚠️ 인터넷 연결이 끊겼습니다. 수기로 기록해주세요.
        </div>
      )}

      {/* ── 체크인 완료 오버레이 ── */}
      {checkInOverlay && (
        <div className="fixed inset-0 z-40 bg-gradient-to-br from-[#1a5fc8] to-[#2672D9] flex flex-col items-center justify-center text-white">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-8">
            <CheckCircle2 className="w-14 h-14 text-white" />
          </div>
          <p className="text-lg font-semibold mb-2 opacity-70 tracking-widest uppercase">출석 완료</p>
          <p className="text-8xl font-black mb-4 tracking-tight">{checkInOverlay.name}</p>
          <div className="flex items-center gap-2 bg-white/15 rounded-2xl px-6 py-3">
            <p className="text-xl font-bold">
              {checkInOverlay.grade}학년 &nbsp;{checkInOverlay.classNum}반 &nbsp;{checkInOverlay.num}번
            </p>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#2672D9] rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-200">H</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-800 leading-tight">효명고 야간자율학습 출결</h1>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md">BETA</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest">HYOMYUNG SMART ROLL CALL</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="mailto:24293@hmh.or.kr" className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors hidden sm:block">
            문의: 차진헌 · 24293@hmh.or.kr
          </a>
          <Link href="/admin">
            <Button variant="ghost" className="text-slate-400 hover:text-slate-600 rounded-xl gap-2">
              <Settings className="w-4 h-4" /> 관리자
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[520px_1fr] gap-6 overflow-hidden">
        {/* ── 좌측: 출석 체크 카드 ── */}
        <div className="glass-card p-7 flex flex-col bg-white">
          {/* 카드 헤더 */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-800">출석 체크</h2>
              <p className="text-xs text-slate-400 mt-0.5">학번 입력 또는 바코드 스캔</p>
            </div>
            <Button
              onClick={() => setIsScannerActive(!isScannerActive)}
              className={cn(
                "rounded-2xl h-14 px-7 font-bold text-base gap-2 shadow-lg transition-all",
                isScannerActive
                  ? "bg-red-500 hover:bg-red-600 shadow-red-200"
                  : "bg-[#2672D9] hover:bg-[#1a5fc8] shadow-blue-200"
              )}
            >
              {isScannerActive ? <StopCircle className="w-5 h-5" /> : <ScanBarcode className="w-5 h-5" />}
              {isScannerActive ? "중지" : "스캔 ON"}
            </Button>
          </div>

          {/* 카메라 뷰 */}
          <div id="qr-reader" className={cn("bg-slate-900 rounded-2xl aspect-[4/3] overflow-hidden", !isScannerActive && "hidden")} />
          {isScannerActive && (
            <p className="text-center text-xs text-slate-400 mt-2 mb-6">📷 학생증 <span className="font-bold text-slate-600">바코드 면</span>을 카메라에 비춰주세요</p>
          )}

          {/* 학번 입력 박스 */}
          {!isScannerActive && (
            <div className="flex gap-2.5 mb-6">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className={cn("input-box flex-1 h-[72px] text-4xl", input[i] && "filled")}>
                  {input[i] || ''}
                </div>
              ))}
            </div>
          )}

          {/* 키패드 */}
          {!isScannerActive && (
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button
                  key={n}
                  onClick={() => input.length < 5 && setInput(p => p + n)}
                  className="keypad-button h-[68px]"
                >
                  {n}
                </button>
              ))}
              <button onClick={() => setInput(p => p.slice(0, -1))} className="keypad-button-special !h-[68px]">
                ←
              </button>
              <button onClick={() => input.length < 5 && setInput(p => p + '0')} className="keypad-button h-[68px]">0</button>
              <button onClick={() => setInput('')} className="keypad-button-special !h-[68px] text-slate-600">CLR</button>
            </div>
          )}

          {/* 상태 메시지 */}
          <div className={cn(
            "mt-5 px-6 py-4 rounded-2xl text-center font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 min-h-[64px]",
            status.type === 'idle'    && "text-slate-400",
            status.type === 'loading' && "bg-blue-50 text-blue-600",
            status.type === 'success' && "bg-emerald-50 text-emerald-700",
            status.type === 'error'   && "bg-red-50 text-red-600",
            status.type === 'warning' && "bg-amber-50 text-amber-700",
          )}>
            {status.type === 'loading' && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
            {status.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
            {(status.type === 'error' || status.type === 'warning') && <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span>{status.message}</span>
          </div>
        </div>

        {/* ── 우측: 실시간 현황 ── */}
        <div className="glass-card flex flex-col bg-white overflow-hidden">
          <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-800">실시간 현황</h2>
            <span className="font-mono text-sm text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              {currentTime ? format(currentTime, 'HH:mm:ss') : '--:--:--'}
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <AttendanceRoster entries={attendance} />
          </div>
        </div>
      </div>
    </div>
  );
}
