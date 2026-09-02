/**
 * JIN.AI 라이브 리셋 — 익명 사전/사후 불편감 수집 백엔드 (Google Apps Script)
 *
 * 배포 방법 (약 5분):
 * 1. Google 스프레드시트 새로 만들기 → 이름: "JINAI_LIVE_RESET_DATA"
 * 2. 확장 프로그램 → Apps Script → 이 파일 내용을 Code.gs 에 붙여넣기 → 저장
 * 3. 배포 → 새 배포 → 유형: 웹 앱
 *      - 설명: live-reset-v1
 *      - 다음 사용자 인증 정보로 실행: 나
 *      - 액세스 권한이 있는 사용자: 모든 사용자 (익명 참가자가 제출해야 하므로 필수)
 * 4. 배포 후 나오는 "웹 앱 URL" (https://script.google.com/macros/s/.../exec) 을
 *    발표 페이지 설정(S 키)의 "백엔드 URL" 에 붙여넣기
 * 5. 코드를 수정한 뒤에는 반드시 배포 → 배포 관리 → 새 버전 으로 갱신
 *
 * 저장되는 값: 시각, 세션코드, 익명토큰(기기 무작위 문자열), 부위, 사전/사후, 점수(0~10), 부가응답(JSON)
 * 이름·연락처·소속·IP는 저장하지 않습니다.
 */

var SHEET_NAME = 'responses';
var PARTS = ['foot', 'neck', 'shoulder', 'back', 'knee'];
var PHASES = ['pre', 'post'];

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || 'rows';
  if (action === 'ping') return out_({ ok: true, ts: new Date().toISOString() });
  if (action === 'rows') {
    var session = String(p.session || '').trim();
    if (!session) return out_({ ok: false, error: 'session required' });
    return out_({ ok: true, session: session, rows: rows_(session) });
  }
  if (action === 'sessions') return out_({ ok: true, sessions: sessions_() });
  return out_({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var session = String(d.session || '').trim();
    var token = String(d.token || '').trim();
    var part = String(d.part || '');
    var phase = String(d.phase || '');
    var score = Number(d.score);
    if (!session || session.length > 64) return out_({ ok: false, error: 'bad session' });
    if (!token || token.length > 64) return out_({ ok: false, error: 'bad token' });
    if (PARTS.indexOf(part) < 0) return out_({ ok: false, error: 'bad part' });
    if (PHASES.indexOf(phase) < 0) return out_({ ok: false, error: 'bad phase' });
    if (!(score >= 0 && score <= 10 && Math.round(score) === score)) return out_({ ok: false, error: 'bad score' });
    var extra = d.extra && typeof d.extra === 'object' ? JSON.stringify(d.extra).slice(0, 500) : '{}';
    sheet_().appendRow([new Date().toISOString(), session, token, part, phase, score, extra]);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function rows_(session) {
  var sh = sheet_();
  var vals = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) !== session) continue;
    rows.push({
      ts: vals[i][0], token: String(vals[i][2]), part: String(vals[i][3]),
      phase: String(vals[i][4]), score: Number(vals[i][5]), extra: safeJson_(vals[i][6])
    });
  }
  return rows;
}

function sessions_() {
  var vals = sheet_().getDataRange().getValues();
  var seen = {};
  for (var i = 1; i < vals.length; i++) {
    var s = String(vals[i][1]);
    if (!seen[s]) seen[s] = { session: s, count: 0, first: vals[i][0] };
    seen[s].count++;
  }
  return Object.keys(seen).map(function (k) { return seen[k]; });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['ts', 'session', 'token', 'part', 'phase', 'score', 'extra']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function safeJson_(s) {
  try { return JSON.parse(s || '{}'); } catch (_) { return {}; }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
