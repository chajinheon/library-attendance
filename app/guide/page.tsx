'use client';

export default function GuidePage() {
  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
        @page { size: A4; margin: 10mm; }
      `}</style>

      {/* 인쇄 버튼 */}
      <div className="no-print flex justify-center gap-3 py-4 bg-slate-100">
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm"
        >
          🖨️ 인쇄하기
        </button>
        <a href="/" className="px-6 py-2 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-700 text-sm">
          메인으로
        </a>
      </div>

      {/* A4 인쇄 영역 */}
      <div className="print-page max-w-[700px] mx-auto my-6 bg-white rounded-2xl shadow-xl overflow-hidden font-['Inter',sans-serif]">

        {/* 헤더 */}
        <div className="bg-[#1a3a6b] px-10 py-8 text-white">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#1a3a6b] font-black text-3xl shadow-lg">H</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">효명고 야간자율학습 출결 시스템</h1>
                <span className="text-xs font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-md">BETA</span>
              </div>
              <p className="text-blue-200 text-sm mt-0.5">HYOMYUNG SMART ROLL CALL · 도서관 운영</p>
            </div>
          </div>
        </div>

        <div className="px-10 py-8 space-y-8">

          {/* 소개 */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <p className="text-slate-700 text-sm leading-relaxed">
              본 시스템은 <strong>학생증 바코드 스캔</strong> 또는 <strong>학번 직접 입력</strong>으로 야간자율학습 출석을 체크하는 스마트 출결 시스템입니다.
              태블릿·PC 브라우저에서 접속하여 사용하세요.
            </p>
          </div>

          {/* 이용 방법 */}
          <div>
            <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#2672D9] rounded-lg flex items-center justify-center text-white text-sm font-black">?</span>
              이용 방법
            </h2>
            <div className="grid grid-cols-2 gap-4">

              {/* 방법 1: 바코드 */}
              <div className="border-2 border-[#2672D9] rounded-2xl p-5 bg-blue-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-[#2672D9] rounded-xl flex items-center justify-center text-white font-black text-sm">1</div>
                  <span className="font-black text-slate-800">학생증 바코드 스캔</span>
                  <span className="ml-auto text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">추천</span>
                </div>
                <ol className="text-sm text-slate-600 space-y-2">
                  <li className="flex gap-2"><span className="text-[#2672D9] font-bold shrink-0">①</span>화면의 <strong>스캔 ON</strong> 버튼 클릭</li>
                  <li className="flex gap-2"><span className="text-[#2672D9] font-bold shrink-0">②</span>학생증 <strong>바코드 면</strong>을 카메라에 비추기</li>
                  <li className="flex gap-2"><span className="text-[#2672D9] font-bold shrink-0">③</span>자동 인식 후 출석 완료 화면 확인</li>
                </ol>
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                  ⚠️ 학생증 <strong>앞면(사진)이 아닌 뒷면 바코드</strong>를 카메라에 비춰주세요
                </div>
              </div>

              {/* 방법 2: 학번 입력 */}
              <div className="border-2 border-slate-200 rounded-2xl p-5 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-slate-600 rounded-xl flex items-center justify-center text-white font-black text-sm">2</div>
                  <span className="font-black text-slate-800">학번 직접 입력</span>
                </div>
                <ol className="text-sm text-slate-600 space-y-2">
                  <li className="flex gap-2"><span className="text-slate-500 font-bold shrink-0">①</span>화면의 숫자 키패드 이용</li>
                  <li className="flex gap-2"><span className="text-slate-500 font-bold shrink-0">②</span><strong>5자리 학번</strong> 입력 (예: 30702)</li>
                  <li className="flex gap-2"><span className="text-slate-500 font-bold shrink-0">③</span>자동 제출 후 출석 완료 확인</li>
                </ol>
                <div className="mt-3 bg-slate-100 rounded-xl px-3 py-2 text-xs text-slate-600">
                  💡 학번: <strong>학년 + 반 + 번호</strong> (예: 3학년 7반 2번 → 30702)
                </div>
              </div>
            </div>
          </div>

          {/* 주의사항 */}
          <div>
            <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center text-white text-sm font-black">!</span>
              주의사항
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🚫', text: '중복 출석 불가\n하루 1회만 인정됩니다' },
                { icon: '🪪', text: '학생증 지참 필수\n바코드 스캔 시 필요합니다' },
                { icon: '🤳', text: '얼굴 인식 불가\n반드시 바코드를 비춰주세요' },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 출석 상태 */}
          <div>
            <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center text-white text-sm font-black">✓</span>
              출석 인식 결과
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { color: 'bg-green-50 border-green-200', icon: '✅', title: '출석 완료', desc: '정상적으로 출석이 처리되었습니다' },
                { color: 'bg-yellow-50 border-yellow-200', icon: '⚠️', title: '이미 출석', desc: '오늘 이미 출석이 완료된 상태입니다' },
                { color: 'bg-red-50 border-red-200', icon: '❌', title: '미등록 학생', desc: '관리자에게 학번 등록을 요청하세요' },
              ].map((item, i) => (
                <div key={i} className={`border rounded-xl p-3 text-center ${item.color}`}>
                  <div className="text-xl mb-1">{item.icon}</div>
                  <p className="text-xs font-bold text-slate-700">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 푸터 */}
          <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-xs text-slate-400">
            <span>효명고등학교 도서관 운영 · 야간자율학습 출결 관리 시스템 BETA</span>
            <span>문의: 도서관 담당 선생님</span>
          </div>
        </div>
      </div>
    </>
  );
}
