// 스펙 검증·정리: node check-spec.js [--fix]
// - 부위 5개·id 확인, 슬라이드 min 합계, 7질문 답 존재, 자리표시자 확인
// - --fix: 화면용 evidence/source 에서 녹취 타임스탬프·파일 경로를 제거해 notes 로 이동, 참고문헌에서 녹취 파일 항목 제거
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, 'src/spec.json');
const spec = JSON.parse(fs.readFileSync(P, 'utf8'));
const fix = process.argv.includes('--fix');
const problems = [], notes = [];
const IDS = ['foot', 'neck', 'shoulder', 'back', 'knee'];
const TS = /\[\d{1,2}:\d{2}(?::\d{2})?\]|\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

// parts
const parts = spec.parts || [];
if (parts.length !== 5) problems.push(`parts ${parts.length}개 (5개 필요)`);
IDS.forEach(id => { if (!parts.find(p => p.id === id)) problems.push(`part 누락: ${id}`); });
parts.forEach(p => {
  ['hypothesis', 'statement', 'check', 'reset', 'compare', 'slogan', 'keep', 'safety', 'ruling', 'notes'].forEach(k => { if (!p[k] || (Array.isArray(p[k]) && !p[k].length)) problems.push(`${p.id}.${k} 비어 있음`); });
  if (p.ruling && !/\{drop\}|\{pct\}/.test(p.ruling)) notes.push(`${p.id}.ruling 에 {drop}/{pct} 자리표시자 없음 (허용)`);
  (p.evidence || []).forEach((e, i) => {
    const s = (e.source || '') + ' ' + (e.text || '');
    if (/녹취|클로바|transcript|\.txt|scratchpad|\[\d{1,2}:\d{2}/.test(s) || (/1회차/.test(s) && TS.test(s))) {
      if (fix) { p.notes = (p.notes || '') + `\n[근거 메모] ${e.text} (${e.source || ''})`; e.text = e.text.replace(TS, '').replace(/\s+—\s*$/, '').trim(); e.source = '1회차(8/31) 현장 관찰 · 자기보고 · 기록 없음(참고)'; notes.push(`${p.id}.evidence[${i}] 타임스탬프 제거 → notes 이동`); }
      else problems.push(`${p.id}.evidence[${i}] 화면용 근거에 녹취 타임스탬프/파일 경로 포함`);
    }
  });
});
// slides
const slides = spec.slides || [];
let sum = 0; slides.forEach(s => { sum += Number(s.min) || 0; if (!s.id || !s.type || !s.title) problems.push(`slide 필수 필드 누락: ${JSON.stringify(s).slice(0, 60)}`); });
if (sum > 10.01) problems.push(`slides min 합계 ${sum} > 10 (부위 40분 + 10분 = 50분 초과)`); else notes.push(`slides min 합계 ${sum} + 부위 40 = ${sum + 40}분`);
const firstPost = slides.findIndex(s => ['verdict', 'close'].includes(s.type) || s.after_parts);
if (firstPost < 0) problems.push('verdict/close 슬라이드 없음');
slides.forEach(s => { (s.evidence || []).forEach((e, i) => { const t = (e.source || '') + ' ' + (e.text || ''); if (/scratchpad|\.txt|클로바/.test(t)) { if (fix) { e.source = (e.source || '').replace(/\/[^\s]+\.txt/g, '').replace(/클로바노트[^,)]*/g, '').trim(); } else problems.push(`slide ${s.id}.evidence[${i}] 파일 경로/녹취 표기`); } }); });
// answers
const answers = spec.answers || [];
[1, 2, 3, 4, 5, 6, 7].forEach(n => { const a = answers.find(x => x.no === n); if (!a) problems.push(`answers ${n}번 없음`); else if (!a.conclusion || !(a.grounds || []).length || !a.today_check) problems.push(`answers ${n}번 필드 부족`); });
// references
(spec.references || []).forEach((r, i) => { if (/scratchpad|\.txt|클로바|녹취/.test((r.citation || '') + (r.url || ''))) { if (fix) { spec.references.splice(i, 1); notes.push(`references[${i}] 녹취 파일 항목 제거`); } else problems.push(`references[${i}] 녹취/파일 경로 항목`); } });
// verdict
if (!spec.verdict || !spec.verdict.headline) problems.push('verdict.headline 없음');

if (fix) fs.writeFileSync(P, JSON.stringify(spec, null, 1));
console.log('== 확인 사항'); notes.forEach(n => console.log(' -', n));
console.log('== 문제', problems.length ? '' : '없음'); problems.forEach(p => console.log(' !', p));
process.exit(problems.length && !fix ? 1 : 0);
