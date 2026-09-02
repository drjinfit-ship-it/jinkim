// 재판형 강의 PPTX 생성 (복습·배포용). 소스: src/spec.json
// 사용: node make-pptx.js [출력.pptx] [--join-base https://.../web/] [--session suwon-2]
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const pptxgen = require('pptxgenjs');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/spec.json'), 'utf8'));
const argv = process.argv.slice(2);
const out = argv.find(a => a.endsWith('.pptx')) || path.join(__dirname, '몸의법정_재판형강의안.pptx');
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const JOIN = arg('--join-base') || 'https://drjinfit-ship-it.github.io/jinkim/web/';
const SESSION = arg('--session') || 'suwon-2';

/* ---- QR → PNG (zlib, 순수 node) ---- */
global.window = global; require('./src/qr-bundle.js');
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function qrPng(text, scale = 8, quiet = 4) {
  const q = global.QRCodeGen(text, 'M'), n = q.getModuleCount(), size = (n + quiet * 2) * scale;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 3 + 1)] = 0; for (let x = 0; x < size; x++) { const r = Math.floor(y / scale) - quiet, c = Math.floor(x / scale) - quiet; const dark = r >= 0 && c >= 0 && r < n && c < n && q.isDark(r, c); const o = y * (size * 3 + 1) + 1 + x * 3; raw[o] = raw[o + 1] = raw[o + 2] = dark ? (dark && 0x0b) : 0xff; if (dark) { raw[o] = 0x0b; raw[o + 1] = 0x17; raw[o + 2] = 0x30; } } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const joinUrl = (part, phase) => `${JOIN}${JOIN.includes('?') ? '&' : '?'}mode=join&s=${encodeURIComponent(SESSION)}&p=${part}&t=${phase}`;

/* ---- 테마 ---- */
const C = { navy: '0B1730', navy2: '132446', navy3: '1C3260', ink: 'F3F6FB', ink2: 'C5D0E2', ink3: '8FA3BF', amber: 'F5B13D', amber2: 'FFD27A', green: '3DD68C', teal: '5FD3C8', coral: 'FF6B6B', warm: '3A2A0F', cool: '0F2E3F', ruling: '0E3B2C' };
const FONT = 'Malgun Gothic';
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.title = spec.title || '몸의 법정'; pres.author = '김진';
const W = 13.33, H = 7.5, M = 0.6;
let no = 0;
function base(eyebrow) {
  const s = pres.addSlide(); s.background = { color: C.navy }; no++;
  if (eyebrow) s.addText(eyebrow, { x: M, y: 0.35, w: W - 2 * M, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.amber, charSpacing: 2, isTextBox: true, margin: 0 });
  s.addText(`${spec.title || '몸의 법정'} · ${SESSION}`, { x: M, y: H - 0.5, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: C.ink3, isTextBox: true, margin: 0 });
  s.addText(String(no), { x: W - M - 1, y: H - 0.5, w: 1, h: 0.3, fontFace: FONT, fontSize: 9, color: C.ink3, align: 'right', isTextBox: true, margin: 0 });
  return s;
}
function title(s, text, y = 0.8, size = 30) { s.addText(text, { x: M, y, w: W - 2 * M, h: 1.1, fontFace: FONT, fontSize: size, bold: true, color: C.ink, isTextBox: true, margin: 0, valign: 'top' }); }
function lead(s, text, y = 1.95, size = 15) { if (text) s.addText(text, { x: M, y, w: W - 2 * M, h: 0.8, fontFace: FONT, fontSize: size, color: C.ink2, isTextBox: true, margin: 0, valign: 'top' }); }
function cards(s, items, y, opts = {}) {
  if (!items || !items.length) return;
  const n = items.length, gap = 0.25, w = (W - 2 * M - gap * (n - 1)) / n, h = opts.h || 2.6;
  items.forEach((c, i) => {
    const x = M + i * (w + gap); const fill = (opts.fill && opts.fill(c, i)) || C.navy2;
    s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.15 });
    s.addText(c.k || '', { x: x + 0.22, y: y + 0.18, w: w - 0.44, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: opts.kColor || C.amber, charSpacing: 1, isTextBox: true, margin: 0 });
    s.addText(c.t || '', { x: x + 0.22, y: y + 0.5, w: w - 0.44, h: 0.8, fontFace: FONT, fontSize: 15, bold: true, color: C.ink, isTextBox: true, margin: 0, valign: 'top' });
    if (c.d) s.addText(Array.isArray(c.d) ? c.d.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < c.d.length - 1, paraSpaceAfter: 4 } })) : c.d, { x: x + 0.22, y: y + 1.3, w: w - 0.44, h: h - 1.45, fontFace: FONT, fontSize: 11.5, color: C.ink2, isTextBox: true, margin: 0, valign: 'top' });
  });
}
function safety(s, text, y = H - 1.25) { if (text) s.addText('! ' + text, { x: M, y, w: W - 2 * M, h: 0.5, fontFace: FONT, fontSize: 11, color: 'FFC9C9', isTextBox: true, margin: 0 }); }
function notes(s, text) { if (text) s.addNotes(text); }

/* ---- 슬라이드 ---- */
const common = spec.slides || [];
let cut = common.findIndex(x => ['verdict', 'close'].includes(x.type) || x.after_parts === true); if (cut < 0) cut = common.length;
const answers = spec.answers || [];
function generic(sl) {
  const s = base(sl.eyebrow || ''); title(s, sl.title); lead(s, sl.lead);
  if (sl.type === 'issues' && answers.length) cards(s, answers.slice(0, 4).map(a => ({ k: `쟁점 ${a.no}`, t: a.question })), 2.8, { h: 1.8 }), cards(s, answers.slice(4).map(a => ({ k: `쟁점 ${a.no}`, t: a.question })), 4.8, { h: 1.6 });
  else cards(s, sl.cards, sl.lead ? 2.9 : 2.2, { fill: (c, i) => sl.type === 'rules' ? C.navy2 : C.navy2 });
  if (sl.quote) s.addText(sl.quote, { x: M, y: H - 1.9, w: W - 2 * M, h: 0.7, fontFace: FONT, fontSize: 16, bold: true, italic: true, color: C.amber2, isTextBox: true, margin: 0 });
  safety(s, sl.safety); notes(s, sl.notes); return s;
}
function issue(sl) {
  const ans = answers.find(a => a.no === sl.question_no) || {};
  const s = base(sl.eyebrow || `쟁점 ${sl.question_no || ''}`); title(s, (sl.question_no ? `${sl.question_no}. ` : '') + sl.title, 0.8, 26); lead(s, sl.lead, 1.75, 13);
  const y = sl.lead ? 2.55 : 2.1, lw = 5.6, rx = M + lw + 0.3, rw = W - 2 * M - lw - 0.3;
  s.addShape(pres.ShapeType.roundRect, { x: M, y, w: lw, h: 1.7, fill: { color: C.warm }, line: { color: C.warm }, rectRadius: 0.15 });
  s.addText('주장 · 가설', { x: M + 0.2, y: y + 0.15, w: lw - 0.4, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: C.amber2, isTextBox: true, margin: 0 });
  s.addText(sl.hypothesis || ans.conclusion || '', { x: M + 0.2, y: y + 0.45, w: lw - 0.4, h: 0.7, fontFace: FONT, fontSize: 14, bold: true, color: C.ink, isTextBox: true, margin: 0, valign: 'top' });
  if (sl.counter) s.addText('반대 가설: ' + sl.counter, { x: M + 0.2, y: y + 1.15, w: lw - 0.4, h: 0.5, fontFace: FONT, fontSize: 10.5, color: C.ink2, isTextBox: true, margin: 0, valign: 'top' });
  const act = sl.action || ans.today_check; if (act) { s.addShape(pres.ShapeType.roundRect, { x: M, y: y + 1.9, w: lw, h: 1.2, fill: { color: C.cool }, line: { color: C.cool }, rectRadius: 0.15 }); s.addText('오늘 현장 확인', { x: M + 0.2, y: y + 2.03, w: lw - 0.4, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: C.teal, isTextBox: true, margin: 0 }); s.addText(act, { x: M + 0.2, y: y + 2.33, w: lw - 0.4, h: 0.72, fontFace: FONT, fontSize: 11.5, color: C.ink, isTextBox: true, margin: 0, valign: 'top' }); }
  const ev = (sl.evidence && sl.evidence.length) ? sl.evidence : (ans.grounds || []).map(g => ({ kind: '근거', text: g }));
  let ey = y; ev.slice(0, 4).forEach(e => { const h = 0.78; s.addShape(pres.ShapeType.roundRect, { x: rx, y: ey, w: rw, h, fill: { color: C.navy2 }, line: { color: C.navy2 }, rectRadius: 0.1 }); s.addText(e.kind || '근거', { x: rx + 0.15, y: ey + 0.12, w: 0.9, h: 0.28, fontFace: FONT, fontSize: 9, bold: true, color: C.teal, isTextBox: true, margin: 0 }); s.addText(e.text + (e.source ? `  (${e.source}${e.confidence ? ' · ' + e.confidence : ''})` : ''), { x: rx + 1.05, y: ey + 0.08, w: rw - 1.2, h: h - 0.14, fontFace: FONT, fontSize: 10.5, color: C.ink, isTextBox: true, margin: 0, valign: 'top' }); ey += h + 0.12; });
  const rul = sl.ruling || ans.conclusion; if (rul) { s.addShape(pres.ShapeType.roundRect, { x: M, y: H - 1.55, w: W - 2 * M, h: 0.75, fill: { color: C.ruling }, line: { color: C.ruling }, rectRadius: 0.12 }); s.addText([{ text: '판단  ', options: { bold: true, color: C.green, fontSize: 10 } }, { text: rul, options: { bold: true, color: C.ink, fontSize: 13 } }], { x: M + 0.2, y: H - 1.5, w: W - 2 * M - 0.4, h: 0.65, fontFace: FONT, isTextBox: true, margin: 0, valign: 'middle' }); }
  notes(s, sl.notes); return s;
}
function qrSlide(p, phase) {
  const pre = phase === 'pre'; const s = base(`${pre ? '진술 접수 · BEFORE' : '재검사 · AFTER'} · ${p.name}`);
  title(s, pre ? `${p.name} — 지금 불편감은 몇 점입니까?` : `${p.name} — 재검사: 지금은 몇 점입니까?`);
  s.addShape(pres.ShapeType.roundRect, { x: M, y: 2.0, w: 3.9, h: 3.9, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.2 });
  s.addImage({ data: 'image/png;base64,' + qrPng(joinUrl(p.id, phase)).toString('base64'), x: M + 0.2, y: 2.2, w: 3.5, h: 3.5 });
  s.addText(joinUrl(p.id, phase), { x: M, y: 6.0, w: 4.2, h: 0.5, fontFace: FONT, fontSize: 8, color: C.ink3, isTextBox: true, margin: 0 });
  const bx = M + 4.4, bw = W - M - bx;
  s.addShape(pres.ShapeType.roundRect, { x: bx, y: 2.0, w: bw, h: 1.7, fill: { color: C.navy2 }, line: { color: C.navy2 }, rectRadius: 0.15 });
  s.addText(pre ? '진술 접수' : '이 강의장 전체 · 불편감 감소 평균', { x: bx + 0.25, y: 2.15, w: bw - 0.5, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: C.ink3, isTextBox: true, margin: 0 });
  s.addText(pre ? '0 ~ 10' : '— 점 감소', { x: bx + 0.25, y: 2.45, w: bw - 0.5, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: pre ? C.amber : C.green, isTextBox: true, margin: 0 });
  s.addText(pre ? (p.statement || '휴대폰으로 QR을 찍고 지금 불편감을 0~10으로 입력합니다') : '현장에서는 실시간 보드로 평균·개선율이 표시됩니다. 같은 부위, 같은 기준으로 다시 입력합니다.', { x: bx + 0.25, y: 3.3, w: bw - 0.5, h: 0.4, fontFace: FONT, fontSize: 10.5, color: C.ink2, isTextBox: true, margin: 0 });
  s.addText(pre ? '이름·연락처·소속을 받지 않습니다. 이 휴대폰의 무작위 번호로만 강의 전·후를 짝지어 익명 집계합니다.' : (p.ruling ? '소결(현장 수치로 채움): ' + p.ruling : '좋아졌으면 좋아진 만큼, 같으면 같게, 더 불편하면 높게 — 솔직한 숫자만 증거가 됩니다.'), { x: bx, y: 4.0, w: bw, h: 1.2, fontFace: FONT, fontSize: 12, color: C.ink2, isTextBox: true, margin: 0, valign: 'top' });
  notes(s, pre ? '[1.5분] 휴대폰을 들고 찍고, 숫자 하나 누르고, 내려놓기. 응답 수가 올라가는 것을 보여주며 기다린다.' : '[1.5분] 같은 기준으로 재검사. 평균 감소 폭과 개선율을 증거처럼 읽어 준다. 변화 없는 분도 데이터라고 말한다.');
  return s;
}
function practice(p, i) {
  const s = base(`증거조사 ${['①', '②', '③', '④', '⑤'][i] || ''} · ${p.name} · 5분`); title(s, p.slogan, 0.8, 26);
  s.addText([{ text: '주장  ', options: { bold: true, color: C.amber, fontSize: 10 } }, { text: p.hypothesis || '', options: { color: C.ink2, fontSize: 13 } }, ...(p.counter ? [{ text: '    반대 가설  ', options: { bold: true, color: C.ink3, fontSize: 10 } }, { text: p.counter, options: { color: C.ink3, fontSize: 12 } }] : [])], { x: M, y: 1.75, w: W - 2 * M, h: 0.6, fontFace: FONT, isTextBox: true, margin: 0, valign: 'top' });
  cards(s, [{ k: '현장 검증 · 체크', t: '', d: p.check }, { k: '개입 실험 · 10초 리셋 · 한쪽만', t: '', d: p.reset }, { k: '대질 · 좌우 비교', t: '', d: [p.compare, '집행(유지): ' + p.keep] }], 2.45, { h: 3.05, fill: (c, j) => [C.navy2, C.cool, C.warm][j] });
  if (p.evidence && p.evidence.length) s.addText(p.evidence.slice(0, 3).map((e, j) => ({ text: `${e.kind || '근거'}: ${e.text}${e.source ? ` (${e.source})` : ''}`, options: { breakLine: j < Math.min(3, p.evidence.length) - 1 } })), { x: M, y: 5.6, w: W - 2 * M, h: 0.7, fontFace: FONT, fontSize: 9.5, color: C.ink2, isTextBox: true, margin: 0, valign: 'top' });
  safety(s, p.safety); notes(s, p.notes); return s;
}
function verdict(sl) {
  const s = base(sl.eyebrow || '판결 · LIVE RESULT'); title(s, sl.title || '오늘 이 강의장은 얼마나 달라졌습니까?'); lead(s, sl.lead || '현장에서는 실시간 보드로 참여자 수, 개선 비율, 평균 감소, 부위별 표가 공개됩니다.');
  const v = spec.verdict || {};
  cards(s, [{ k: '참여자', t: '— 명', d: '익명 기기 기준' }, { k: '1개 부위 이상 개선', t: '— %', d: '전후 짝 기준' }, { k: '평균 불편감 감소', t: '— 점', d: '전후 응답 쌍 기준' }, { k: '2점 이상 감소', t: '— %', d: '임상적 의미 있는 변화 기준은 만성통증 연구 맥락' }], 2.9, { h: 1.6 });
  s.addText([v.order ? { text: '주문  ' + v.order + '\n', options: {} } : null, v.reason ? { text: '이유  ' + v.reason + '\n', options: {} } : null, v.condition ? { text: '조건  ' + v.condition + '\n', options: {} } : null, { text: '한계  ' + (v.limit || '교육 직후 익명 자기보고, 대조군 없음, 의학적 효과를 의미하지 않음.'), options: {} }].filter(Boolean), { x: M, y: 4.75, w: W - 2 * M, h: 1.6, fontFace: FONT, fontSize: 11.5, color: C.ink2, isTextBox: true, margin: 0, valign: 'top' });
  notes(s, sl.notes); return s;
}
function references() {
  if (!spec.references || !spec.references.length) return;
  const s = base('참고 근거 · 감정인 제출'); title(s, '이 강의가 기댄 근거', 0.8, 26);
  s.addText(spec.references.map((r, j) => ({ text: `${r.citation}${r.used_for ? ' — ' + r.used_for : ''}${r.confidence ? '  [신뢰도 ' + r.confidence + ']' : ''}`, options: { bullet: true, breakLine: j < spec.references.length - 1, paraSpaceAfter: 6 } })), { x: M, y: 1.9, w: W - 2 * M, h: 4.6, fontFace: FONT, fontSize: 11, color: C.ink2, isTextBox: true, margin: 0, valign: 'top' });
}
function answersSlide() {
  if (!answers.length) return;
  const s = base('판사의 질문 7개 · 최종 답'); title(s, '7개 질문에 대한 감정인의 답', 0.8, 26);
  const rows = [[{ text: '#', options: { bold: true, color: C.ink3 } }, { text: '질문', options: { bold: true, color: C.ink3 } }, { text: '한 문장 결론', options: { bold: true, color: C.ink3 } }, { text: '오늘 현장 확인', options: { bold: true, color: C.ink3 } }]];
  answers.forEach(a => rows.push([String(a.no), a.question, a.conclusion, a.today_check]));
  s.addTable(rows, { x: M, y: 1.8, w: W - 2 * M, colW: [0.5, 3.4, 4.6, 3.6], fontFace: FONT, fontSize: 10, color: C.ink, fill: { color: C.navy2 }, border: { type: 'solid', color: C.navy3, pt: 0.5 }, rowH: 0.55, valign: 'middle' });
}

common.slice(0, cut).forEach(sl => (sl.type === 'issue' ? issue : generic)(sl));
(spec.parts || []).forEach((p, i) => { qrSlide(p, 'pre'); practice(p, i); qrSlide(p, 'post'); });
common.slice(cut).forEach(sl => (sl.type === 'verdict' ? verdict : sl.type === 'issue' ? issue : generic)(sl));
if (!common.some(x => x.type === 'verdict')) verdict({});
answersSlide(); references();
pres.writeFile({ fileName: out }).then(() => console.log('wrote', out, 'slides', no));
