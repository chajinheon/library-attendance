'use client';

export default function GuidePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Noto Sans KR',sans-serif;background:#d1d5db;min-height:100vh;display:flex;justify-content:center;align-items:center;padding:30px;}
        .poster{width:780px;background:#fff;position:relative;overflow:hidden;}
        .hero{background:#1a2744;color:#fff;padding:48px 50px 42px;position:relative;}
        .hero::after{content:'';position:absolute;bottom:-24px;left:50px;width:80px;height:48px;background:#1a2744;clip-path:polygon(0 0,100% 0,50% 100%);}
        .hero-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;}
        .school-label{font-size:12px;font-weight:600;letter-spacing:1px;color:rgba(255,255,255,0.5);text-transform:uppercase;}
        .beta-tag{font-size:10px;font-weight:700;background:#e74c3c;color:#fff;padding:3px 10px;border-radius:2px;letter-spacing:1px;}
        .hero h1{font-size:38px;font-weight:900;line-height:1.2;letter-spacing:-1.5px;margin-bottom:6px;}
        .hero h1 em{font-style:normal;color:#5ba4f5;}
        .hero .tagline{font-size:14px;color:rgba(255,255,255,0.6);font-weight:400;}
        .body{padding:44px 50px 40px;}
        .how-to{display:flex;gap:0;margin-bottom:32px;border:2px solid #1a2744;border-radius:4px;overflow:hidden;}
        .way{flex:1;padding:28px 26px;}
        .way+.way{border-left:2px solid #1a2744;}
        .way-header{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
        .way-num{width:28px;height:28px;background:#1a2744;color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;border-radius:3px;flex-shrink:0;}
        .way-title{font-size:18px;font-weight:800;color:#1a2744;}
        .rec-badge{font-size:9px;font-weight:700;background:#e74c3c;color:#fff;padding:2px 6px;border-radius:2px;margin-left:4px;vertical-align:middle;letter-spacing:0.5px;}
        .way-desc{font-size:12.5px;color:#888;margin-bottom:16px;padding-left:38px;}
        .step-list{list-style:none;padding-left:38px;}
        .step-list li{position:relative;font-size:13.5px;color:#333;padding:6px 0 6px 24px;line-height:1.5;}
        .step-list li::before{content:attr(data-step);position:absolute;left:0;top:6px;width:18px;height:18px;background:#eef2f7;color:#1a2744;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:2px;}
        .step-list li+li{border-top:1px dashed #e5e5e5;}
        .step-list li strong{font-weight:700;color:#1a2744;}
        .id-box{background:#f7f8fa;border-left:4px solid #1a2744;padding:20px 24px;margin-bottom:30px;display:flex;align-items:center;gap:24px;}
        .id-box-text h4{font-size:14px;font-weight:800;color:#1a2744;margin-bottom:4px;}
        .id-box-text p{font-size:12.5px;color:#666;margin-bottom:10px;}
        .id-visual{display:flex;align-items:center;gap:4px;}
        .id-block{text-align:center;}
        .id-block .num{font-family:'Courier New',monospace;font-size:24px;font-weight:900;padding:4px 10px;display:block;border-radius:3px;margin-bottom:2px;}
        .id-block .lbl{font-size:9px;color:#999;font-weight:500;}
        .id-block.g .num{background:#dbeafe;color:#1e40af;}
        .id-block.c .num{background:#e0e7ff;color:#4338ca;}
        .id-block.n .num{background:#d1fae5;color:#065f46;}
        .id-eq{font-size:20px;font-weight:700;color:#ccc;padding-bottom:14px;}
        .id-block.result .num{background:#1a2744;color:#fff;letter-spacing:3px;font-size:26px;padding:6px 14px;}
        .section-label{font-size:13px;font-weight:800;color:#1a2744;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #1a2744;display:inline-block;}
        .results{display:flex;gap:12px;margin-bottom:30px;}
        .result-item{flex:1;text-align:center;padding:18px 12px;border:2px solid;border-radius:4px;}
        .result-item.ok{border-color:#22c55e;background:#f0fdf4;}
        .result-item.dup{border-color:#eab308;background:#fefce8;}
        .result-item.err{border-color:#ef4444;background:#fef2f2;}
        .result-item .r-icon{font-size:28px;margin-bottom:6px;}
        .result-item h4{font-size:14px;font-weight:700;margin-bottom:3px;}
        .result-item.ok h4{color:#16a34a;}
        .result-item.dup h4{color:#ca8a04;}
        .result-item.err h4{color:#dc2626;}
        .result-item p{font-size:11px;color:#777;line-height:1.4;}
        .notices{display:flex;gap:0;border:2px solid #e74c3c;border-radius:4px;overflow:hidden;margin-bottom:32px;}
        .notices::before{content:'!';display:flex;align-items:center;justify-content:center;background:#e74c3c;color:#fff;font-size:24px;font-weight:900;padding:0 18px;flex-shrink:0;}
        .notice-list{display:flex;flex:1;}
        .notice-item{flex:1;padding:16px 18px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;}
        .notice-item+.notice-item{border-left:1px solid #f0d0cd;}
        .notice-item strong{font-size:13px;font-weight:700;color:#c0392b;display:block;}
        .notice-item span{font-size:11px;color:#888;line-height:1.4;}
        .footer{background:#f7f8fa;padding:18px 50px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e5e5e5;}
        .footer-left{font-size:12px;color:#999;}
        .footer-left strong{color:#1a2744;font-weight:700;font-size:13px;}
        .footer-right{font-size:11px;color:#aaa;}
        .print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#1a2744;color:#fff;font-family:'Noto Sans KR',sans-serif;font-size:14px;font-weight:700;border:none;border-radius:6px;cursor:pointer;z-index:100;}
        @media print{
          body{background:#fff;padding:0;}
          .poster{box-shadow:none;width:100%;}
          .print-btn{display:none;}
          *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        }
      `}</style>

      <button className="print-btn" onClick={() => window.print()}>🖨️ 인쇄하기</button>

      <div className="poster">
        <div className="hero">
          <div className="hero-top">
            <span className="school-label">Hyomyung High School · Library</span>
            <span className="beta-tag">BETA</span>
          </div>
          <h1>야간자율학습<br /><em>스마트 출결</em> 시스템</h1>
          <p className="tagline">학생증 바코드 스캔 또는 학번 직접 입력으로 출석 체크</p>
        </div>

        <div className="body">
          <div className="how-to">
            <div className="way">
              <div className="way-header">
                <span className="way-num">1</span>
                <span className="way-title">바코드 스캔 <span className="rec-badge">추천</span></span>
              </div>
              <p className="way-desc">학생증 뒷면을 카메라에 비춰주세요</p>
              <ul className="step-list">
                <li data-step="①">화면의 <strong>스캔 ON</strong> 버튼 클릭</li>
                <li data-step="②">학생증 <strong>뒷면 바코드</strong>를 카메라에 비추기</li>
                <li data-step="③">자동 인식 → <strong>출석 완료</strong></li>
              </ul>
            </div>
            <div className="way">
              <div className="way-header">
                <span className="way-num">2</span>
                <span className="way-title">학번 직접 입력</span>
              </div>
              <p className="way-desc">학생증이 없어도 출석할 수 있어요</p>
              <ul className="step-list">
                <li data-step="①">화면의 <strong>숫자 키패드</strong> 이용</li>
                <li data-step="②"><strong>5자리 학번</strong> 입력</li>
                <li data-step="③">자동 제출 → <strong>출석 완료</strong></li>
              </ul>
            </div>
          </div>

          <div className="id-box">
            <div className="id-box-text">
              <h4>학번 구성법</h4>
              <p>학년(1자리) + 반(2자리) + 번호(2자리)</p>
            </div>
            <div className="id-visual">
              <div className="id-block g">
                <span className="num">3</span>
                <span className="lbl">학년</span>
              </div>
              <div className="id-block c">
                <span className="num">07</span>
                <span className="lbl">반</span>
              </div>
              <div className="id-block n">
                <span className="num">02</span>
                <span className="lbl">번호</span>
              </div>
              <span className="id-eq">=</span>
              <div className="id-block result">
                <span className="num">30702</span>
                <span className="lbl">학번</span>
              </div>
            </div>
          </div>

          <div className="section-label">출석 인식 결과</div>
          <div className="results">
            <div className="result-item ok">
              <div className="r-icon">✓</div>
              <h4>출석 완료</h4>
              <p>정상적으로 출석 처리됨</p>
            </div>
            <div className="result-item dup">
              <div className="r-icon">⚠</div>
              <h4>이미 출석</h4>
              <p>오늘 이미 출석 완료 상태</p>
            </div>
            <div className="result-item err">
              <div className="r-icon">✗</div>
              <h4>미등록 학생</h4>
              <p>관리자에게 등록 요청</p>
            </div>
          </div>

          <div className="notices">
            <div className="notice-list">
              <div className="notice-item">
                <strong>중복 출석 불가</strong>
                <span>하루 1회만 인정</span>
              </div>
              <div className="notice-item">
                <strong>바코드 면 확인</strong>
                <span>앞면(사진) 아닌 뒷면</span>
              </div>
              <div className="notice-item">
                <strong>얼굴 인식 불가</strong>
                <span>반드시 바코드를 비춰주세요</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footer">
          <div className="footer-left">
            <strong>효명고등학교</strong> 도서관 운영
          </div>
          <div className="footer-right">
            문의 → 도서관 담당 선생님
          </div>
        </div>
      </div>
    </>
  );
}
