// ============================================================
//  AMIR TEMUR SHAXMATI — tutorial.js  v4
//  Wikibooks "Chess Variants/Tamerlane Chess" asosida to'g'rilangan
//  (xato qoidalar tuzatildi, Vizier/Picket/Maxsus qoidalar qo'shildi)
// ============================================================

let tutStep  = 0;
const TUT_TOTAL = 12;

// ── VIZUAL FUNKSIYALAR ────────────────────────────────────────

function tutVisualBoard() {
  let cells = '';
  for (let r=0; r<11; r++) {
    for (let c=0; c<10; c++) {
      const bg = (r+c)%2===0 ? '#F0D9B5' : '#B58863';
      cells += `<div style="width:20px;height:20px;background:${bg};"></div>`;
    }
  }
  return `<div style="padding:16px;text-align:center;">
    <div style="display:inline-grid;grid-template-columns:repeat(10,20px);
      border:2px solid rgba(201,168,76,0.7);border-radius:4px;overflow:hidden;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);">${cells}</div>
    <div style="margin-top:10px;font-size:0.75rem;color:#C9A84C;font-family:'Cinzel',serif;">
      10 × 11 = 110 katak
    </div>
    <div style="margin-top:6px;font-size:0.7rem;color:rgba(245,237,214,0.5);">
      Markaziy Osiyodan kelgan o'rta asr shaxmati • XIV-XV asr
    </div>
  </div>`;
}

function tutVisualPawn() {
  const g = [[0,0,0,0,0],[0,0,2,0,0],[0,3,1,3,0],[0,0,0,0,0]];
  return makeMoveGrid(g, '♟', 44, [
    {color:'rgba(107,196,106,0.9)', label:"Yurish"},
    {color:'rgba(224,96,96,0.9)',   label:'Yutish'},
  ]);
}

function tutVisualKing() {
  const g = [[0,2,2,2,0],[0,2,1,2,0],[0,2,2,2,0]];
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;">
    ${makeMoveGrid(g, '♔', 48)}
    <div style="font-size:0.75rem;color:rgba(245,237,214,0.6);text-align:center;max-width:240px;">
      O'yin davomida <b>1 marta</b> shoh o'zining boshqa donasi bilan
      joy almashtirib, mat yoki pat holatidan qochishi mumkin.
    </div>
  </div>`;
}

function tutVisualVizier() {
  // Vizier (Wazir): faqat 1 to'g'ri (gorizontal/vertikal) qadam
  const g = [[0,2,0],[2,1,2],[0,2,0]];
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;">
    ${makeMoveGrid(g, '♜', 48)}
    <div style="font-size:0.75rem;color:rgba(245,237,214,0.6);text-align:center;max-width:220px;">
      Vizier <b>faqat 1 to'g'ri</b> (gorizontal yoki vertikal) qadam yuradi —
      diagonal yura olmaydi!
    </div>
  </div>`;
}

function tutVisualGeneral() {
  // General (Ferz): faqat 1 diagonal — klassik shatranj Ferz!
  const g = [[2,0,2],[0,1,0],[2,0,2]];
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;">
    ${makeMoveGrid(g, '♕', 48)}
    <div style="font-size:0.75rem;color:rgba(245,237,214,0.6);text-align:center;max-width:220px;">
      ⚠️ General <b>faqat 1 diagonal</b> qadam yuradi —
      zamonaviy Ferz kabi uzoqqa sura olmaydi!
    </div>
  </div>`;
}

function tutVisualPicket() {
  // Picket (Tali'a): fil (bishop) kabi diagonal suradi, lekin KAMIDA 2 katak
  const size = 7, c = 3;
  const g = Array.from({length:size},()=>Array(size).fill(0));
  g[c][c] = 1;
  for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    for (let dist=2; dist<=3; dist++) {
      const r = c+dr*dist, cc = c+dc*dist;
      if (r>=0 && r<size && cc>=0 && cc<size) g[r][cc] = 2;
    }
  }
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;">
    ${makeMoveGrid(g, '♝', 32)}
    <div style="font-size:0.75rem;color:rgba(245,237,214,0.6);text-align:center;max-width:240px;">
      Picket zamonaviy Fil (bishop) kabi diagonal <b>suradi</b>, lekin
      <b>kamida 2 katak</b> — 1 katakka yura olmaydi!
    </div>
  </div>`;
}

function tutVisualBishop() {
  // Fil (Elephant): 2 diagonal sakrash, to'siqdan o'tadi
  const g = Array.from({length:7},()=>Array(7).fill(0));
  g[3][3]=1;
  for(const[dr,dc] of [[-2,-2],[-2,2],[2,-2],[2,2]]) g[3+dr][3+dc]=2;
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;">
    ${makeMoveGrid(g,'♗',36)}
    <div style="font-size:0.75rem;color:rgba(245,237,214,0.6);text-align:center;max-width:220px;">
      Fil <b>2 diagonal</b> sakraydi — o'rtada to'siq bo'lsa ham o'tib ketadi!
    </div>
  </div>`;
}

function tutVisualCamel() {
  // Teva (Camel): cho'zilgan ot — 3+1 sakrash, to'siqdan o'tadi
  const g = Array.from({length:7},()=>Array(7).fill(0));
  g[3][3]=1;
  for(const[dr,dc] of [[-3,-1],[-3,1],[-1,-3],[-1,3],[3,-1],[3,1],[1,-3],[1,3]]){
    if(3+dr>=0&&3+dr<7&&3+dc>=0&&3+dc<7) g[3+dr][3+dc]=2;
  }
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;">
    ${makeMoveGrid(g,'♘',36)}
    <div style="font-size:0.75rem;color:rgba(245,237,214,0.6);text-align:center;max-width:220px;">
      Teva <b>3+1</b> sakraydi — Ot ning kattaroq versiyasi.
      U ham to'siqlardan sakrab o'tadi!
    </div>
  </div>`;
}

function tutVisualGiraffe() {
  // Giraf: AVVAL 1 qadam diagonal, SO'NG kamida 3 qadam to'g'ri (sakrash emas!)
  const size = 9, c = 4;
  const g = Array.from({length:size},()=>Array(size).fill(0));
  g[c][c] = 1;
  g[c-1][c+1] = 3; // 1-bosqich: diagonal qadam
  for (let dist=3; dist<=4; dist++) {
    if (c-1-dist>=0) g[c-1-dist][c+1] = 2;       // 2-bosqich: yuqoriga
    if (c+1+dist<size) g[c-1][c+1+dist] = 2;     // 2-bosqich: o'ngga
  }
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;">
    ${makeMoveGrid(g, '♛', 26, [
      {color:'rgba(224,96,96,0.9)', label:'1-qadam: diagonal'},
      {color:'rgba(107,196,106,0.9)', label:"2-qadam: kamida 3 to'g'ri"},
    ])}
    <div style="font-size:0.75rem;color:rgba(245,237,214,0.6);text-align:center;max-width:260px;">
      Giraf <b>avval 1 qadam diagonal</b>, so'ngra <b>kamida 3 qadam to'g'ri</b>
      (gorizontal/vertikal) suradi. Bu — sakrash emas, 2 bosqichli yurish!
      (Boshqa 3 diagonal yo'nalishda ham xuddi shunday yuradi.)
    </div>
  </div>`;
}

function tutVisualWarEngine() {
  // Dabbaba (Urush mashinasi): 2 to'g'ri sakrash, to'siqdan o'tadi
  const g = Array.from({length:5},()=>Array(5).fill(0));
  g[2][2]=1; g[0][2]=2; g[4][2]=2; g[2][0]=2; g[2][4]=2;
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;">
    ${makeMoveGrid(g,'♖',48)}
    <div style="font-size:0.75rem;color:rgba(245,237,214,0.6);text-align:center;max-width:220px;">
      Dabbaba <b>2 to'g'ri</b> sakraydi — o'rtadagi figuradan o'tib ketadi!
    </div>
  </div>`;
}

function tutVisualSpecialRules() {
  const rows = [
    {icon:'🏯', title:"Qal'a (Citadel)", text:"Har bir o'yinchining 2-qatoridan chiqib turgan maxsus katak. Faqat RAQIB shohi shu katakka kira oladi — bu durang bilan tugaydi."},
    {icon:'♻️', title:'Pat (Stalemate)', text:"Zamonaviy shaxmatdan farqli — pat holatini keltirgan o'yinchi YUTADI, durang emas!"},
    {icon:'🎲', title:'Birinchi yurish', text:'Kim birinchi yurishini zar tashlab hal qilinadi.'},
    {icon:'👑', title:'Shahzoda', text:"Shoh piyodasi oxiriga yetib borsa, Shahzodaga aylanadi — u ham shoh kabi yuradi va himoyalanishi shart."},
    {icon:'👑', title:"Tasodifiy shoh", text:"Piyodalar piyodasi taxta oxiriga 3 marta yetganidan keyin Tasodifiy shohga aylanadi — bu ham himoyalanishi kerak bo'lgan qirollik figura."},
  ];
  return `<div style="display:flex;flex-direction:column;gap:10px;padding:16px;max-width:320px;">
    ${rows.map(r=>`
      <div style="display:flex;gap:10px;align-items:flex-start;background:rgba(255,255,255,0.03);
        border-radius:8px;padding:10px 12px;">
        <div style="font-size:1.3rem;line-height:1;">${r.icon}</div>
        <div>
          <div style="font-size:0.8rem;color:#C9A84C;font-weight:600;">${r.title}</div>
          <div style="font-size:0.72rem;color:rgba(245,237,214,0.65);margin-top:2px;">${r.text}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

function tutVisualReady() {
  return `<div style="display:flex;flex-direction:column;align-items:center;
    justify-content:center;height:260px;gap:14px;padding:20px;">
    <div style="font-size:3rem;animation:floatPiece 3s ease-in-out infinite;">♞</div>
    <div style="font-family:'Cinzel',serif;font-size:0.95rem;color:#C9A84C;text-align:center;">
      Amir Temur Shaxmati
    </div>
    <div style="font-size:0.72rem;color:rgba(245,237,214,0.45);text-align:center;font-style:italic;">
      Shatranjdan kelib chiqgan o'rta asr o'yini
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:4px;">
      ${[
        {s:'♔',l:'Shoh'},{s:'♜',l:'Tura'},{s:'♘',l:'Ot'},
        {s:'♕',l:'General'},{s:'♗',l:'Fil'},
      ].map(({s,l})=>`
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
          <div style="font-size:1.6rem;">${s}</div>
          <div style="font-size:0.6rem;color:rgba(201,168,76,0.7);">${l}</div>
        </div>`).join('')}
    </div>
    <div style="font-size:0.75rem;color:rgba(245,237,214,0.5);">
      va yana: Vizier · Picket · Giraf · Teva · Dabbaba
    </div>
  </div>`;
}

// ── GRID YASASH ───────────────────────────────────────────────
function makeMoveGrid(grid, symbol, cellSize, legendItems) {
  const rows=grid.length, cols=grid[0].length;
  const bg={0:'transparent',1:'rgba(201,168,76,0.25)',
            2:'rgba(107,196,106,0.5)',3:'rgba(224,96,96,0.5)'};
  let cells='';
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const v=grid[r][c];
    const inner = v===1
      ? `<span style="font-size:${cellSize*0.58}px;line-height:1">${symbol}</span>`
      : (v===2||v===3)
        ? `<div style="width:${cellSize*0.3}px;height:${cellSize*0.3}px;
            border-radius:50%;background:${bg[v]};filter:brightness(1.6);"></div>`
        : '';
    cells+=`<div style="width:${cellSize}px;height:${cellSize}px;
      background:${bg[v]};border:1px solid rgba(255,255,255,0.07);
      display:flex;align-items:center;justify-content:center;border-radius:2px;">
      ${inner}</div>`;
  }
  const legend = legendItems
    ? legendItems.map(l=>`<div style="display:flex;align-items:center;gap:5px;
        font-size:0.7rem;color:rgba(245,237,214,0.65);">
        <div style="width:10px;height:10px;border-radius:50%;background:${l.color};"></div>${l.label}
      </div>`).join('')
    : `<div style="display:flex;align-items:center;gap:5px;font-size:0.7rem;color:rgba(245,237,214,0.65);">
        <div style="width:10px;height:10px;border-radius:50%;background:rgba(107,196,106,0.8);"></div>
        Mumkin yurishlar</div>`;

  return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
    <div style="display:inline-grid;grid-template-columns:repeat(${cols},${cellSize}px);gap:2px;">
      ${cells}
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;">${legend}</div>
  </div>`;
}

// ── QADAM RENDER ──────────────────────────────────────────────
const TUT_VIZ_FNS = [
  tutVisualBoard, tutVisualPawn, tutVisualKing, tutVisualVizier,
  tutVisualGeneral, tutVisualPicket, tutVisualBishop, tutVisualCamel,
  tutVisualGiraffe, tutVisualWarEngine, tutVisualSpecialRules, tutVisualReady
];

// MS 7322 ga mos tutorial matnlari (translations.js yetarli bo'lmasa)
//
// ESLATMA: Bu massiv FAQAT translations.js ichida mos tut_* kalit topilmaganda
// ishlatiladigan zaxira (fallback) matn — shuning uchun hozircha faqat o'zbek
// tilida. 8 tilda to'liq ko'rsatish uchun translations.js fayliga ham mos
// kalitlarni (masalan tut_3_title / tut_3_text — Vizier, tut_5 — Picket,
// tut_10 — Maxsus qoidalar) qo'shish kerak bo'ladi.
const TUT_FALLBACK = [
  {title:"Taxta haqida",
   text:"Amir Temur Shaxmati 10×11 katakli, rangsiz (bir xil rangdagi) taxtada o'ynaladi. Har bir o'yinchining 2-qatoridan o'ng tomonga chiqib turgan \"qal'a\" (citadel) katagi bo'ladi."},
  {title:"Piyodalar",
   text:"Har bir figuraning o'z piyodasi bor — jami 11 xil piyoda. Piyoda faqat 1 qadam oldinga yuradi (boshida ham 2 qadam YO'Q, shuning uchun \"en passant\" qoidasi ham yo'q). Oxirgi qatorga yetganda o'ziga mos figuraga aylanadi."},
  {title:"Shoh",
   text:"Shoh har qanday tomonga 1 qadam yuradi. O'yin davomida 1 marta o'z donasi bilan joy almashtirib, mat yoki pat holatidan qochishi mumkin. Shohni himoya qilish — asosiy maqsad!"},
  {title:'Vizier — V',
   text:"Vizier faqat 1 to'g'ri (gorizontal yoki vertikal) qadam yuradi — diagonal yura olmaydi. General ning \"to'g'ri\" versiyasi, deb tasavvur qilish mumkin."},
  {title:"General — G",
   text:"General faqat 1 diagonal qadam yuradi! Bu zamonaviy shaxmatdagi Ferz emas — ancha zaifroq, lekin General nomi bilan ataladi."},
  {title:'Picket — P',
   text:"Picket zamonaviy Fil (bishop) kabi diagonal suradi, ammo KAMIDA 2 katak masofaga yurishi shart — 1 katakka yura olmaydi."},
  {title:"Fil — F",
   text:"Fil 2 diagonal katak sakraydi — o'rtada to'siq bo'lsa ham o'tib ketadi! Doim bir xil rangli katakda qoladi."},
  {title:"Teva — T",
   text:"Teva 3+1 sakrash qiladi — bu Ot ning kattaroq versiyasi. U ham to'siqlardan sakrab o'tadi!"},
  {title:"Giraf — Gr",
   text:"Giraf avval 1 qadam diagonal, so'ngra kamida 3 qadam to'g'ri (gorizontal/vertikal) yuradi. Bu sakrash emas — 2 bosqichli yurish!"},
  {title:"Dabbaba — D",
   text:"Urush mashinasi (Dabbaba) 2 ta to'g'ri katak sakraydi — o'rtadagi figuradan o'tib ketadi!"},
  {title:"Maxsus qoidalar",
   text:"Qal'aga faqat raqib shohi kira oladi (durang bo'ladi). Pat holati — g'alaba (zamonaviydan farqli)! Birinchi yurishni zar hal qiladi. Shoh piyodasi — Shahzodaga, Piyodalar piyodasi (3 marta oxiriga yetgach) — Tasodifiy shohga aylanadi."},
  {title:"Tayyor!",
   text:"Amir Temur shaxmatining barcha qoidalarini o'rganib oldingiz! O'yinda har bir figuraga bosganingizda uning qoidasi ko'rsatiladi."},
];

function renderTutStep(step) {
  const titleEl = document.getElementById('tut-step-title');
  const textEl  = document.getElementById('tut-step-text');
  const numEl   = document.getElementById('tut-step-num');
  const totEl   = document.getElementById('tut-step-total');
  const barEl   = document.getElementById('progress-bar-fill');
  const vizEl   = document.getElementById('tut-visual');
  const prevBtn = document.getElementById('tut-prev-btn');
  const nextBtn = document.getElementById('tut-next-btn');
  if (!vizEl || !titleEl) return;

  // Matn: avval translations.js dan olishga urining, aks holda fallback
  let stepData;
  try { stepData = tStep(step); } catch(e) { stepData = null; }
  if (!stepData || !stepData.title) stepData = TUT_FALLBACK[step] || TUT_FALLBACK[0];

  titleEl.textContent = stepData.title || '';
  textEl.textContent  = stepData.text  || '';
  if (numEl) numEl.textContent = step + 1;
  if (totEl) totEl.textContent = TUT_TOTAL;
  if (barEl) barEl.style.width = ((step+1)/TUT_TOTAL*100) + '%';

  const fn = TUT_VIZ_FNS[step] || tutVisualBoard;
  vizEl.innerHTML = fn();

  if (prevBtn) prevBtn.style.visibility = step===0 ? 'hidden' : 'visible';
  if (nextBtn) {
    if (step===TUT_TOTAL-1) {
      nextBtn.textContent = (typeof t==='function' ? t('tut_done') : null) || "O'yinni boshlash!";
      nextBtn.onclick = () => showSection('game');
    } else {
      nextBtn.textContent = (typeof t==='function' ? t('tut_next') : null) || 'Keyingisi →';
      nextBtn.onclick = tutNext;
    }
  }

  renderTutDots(step);

  vizEl.style.opacity='0'; vizEl.style.transform='translateX(14px)';
  requestAnimationFrame(()=>{
    vizEl.style.transition='opacity 0.3s ease, transform 0.3s ease';
    vizEl.style.opacity='1'; vizEl.style.transform='translateX(0)';
  });
}

function renderTutDots(current) {
  const container = document.getElementById('step-dots');
  if (!container) return;
  container.innerHTML='';
  for(let i=0;i<TUT_TOTAL;i++){
    const dot=document.createElement('div');
    dot.className='step-dot'+(i===current?' active':'');
    dot.onclick=()=>{ tutStep=i; renderTutStep(i); };
    container.appendChild(dot);
  }
}

function tutNext() {
  if (tutStep<TUT_TOTAL-1){ tutStep++; renderTutStep(tutStep); }
}
function tutPrev() {
  if (tutStep>0){ tutStep--; renderTutStep(tutStep); }
}
function initTutorial() {
  tutStep=0;
  renderTutStep(0);
}