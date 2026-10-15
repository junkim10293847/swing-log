/**
 * 스윙 로그 — 구글 앱스 스크립트 서버
 *
 * 기록은 구글 시트에 쌓입니다. 시트는 처음 실행할 때 자동으로 만들어집니다.
 *   클럽      — 클럽 한 개가 한 줄
 *   연습기록  — 클럽 10회 평균 한 세트가 한 줄
 *   연습일지  — 연습 한 번이 한 줄 (준비운동·마무리·느낀점)
 *   라운드    — 라운드 한 번이 한 줄
 *   기준설정  — 클럽별 목표 숫자. 이 시트에서 직접 고치면 앱에 반영됩니다
 *
 * 방향각과 사이드스핀은 부호 있는 숫자로 저장합니다. 음수가 왼쪽(L), 양수가 오른쪽(R).
 * 예) L4.0 → -4,  R282 → 282
 */

var SH = {
  club:  '클럽',
  shot:  '연습기록',
  log:   '연습일지',
  round: '라운드',
  cfg:   '기준설정'
};

var HEAD = {};
HEAD[SH.club]  = ['id','순서','이름','분류','브랜드','모델','로프트','샤프트','플렉스','길이','구입시기','예비','메모','클럽특성','점검사항','연습법'];
HEAD[SH.shot]  = ['id','연습id','날짜','클럽id','클럽명','비거리','캐리','최고높이','볼스피드','발사각','방향각','사이드스핀','백스핀','앞뒤편차','좌우편차','안착률','등급','기준안','부족한점','코칭'];
HEAD[SH.log]   = ['id','날짜','준비운동','마무리운동','느낀점','코칭','기록시각'];
HEAD[SH.round] = ['id','날짜','종류','코스','스코어','파','퍼팅','페어웨이','그린적중','OB','벌타','더블이상','파이상','메모','분석'];
HEAD[SH.cfg]   = ['클럽키','이름','캐리최소','캐리최대','발사각최소','발사각최대','백스핀최소','백스핀최대','좌우편차최대','앞뒤편차최대','방향각허용'];

/* 여러 사람이 쓰므로 모든 줄에 주인을 적는다. 기존 시트에는 맨 뒤에 덧붙는다. */
var OWNER = '사용자id';
[SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (n) { HEAD[n].push(OWNER); });

SH.user = '사용자';
HEAD[SH.user] = ['id','이름','솔트','해시','표시이름','가입일'];

/* 이번 요청을 보낸 사람. doPost 가 토큰을 풀어 채운다. */
var CUR_UID = '';

/* 기준설정 시트 초기값 — 사용자의 실측값을 바탕으로 잡은 목표 구간 */
var CFG_DEFAULT = [
  ['driver','드라이버',172,190,13.5,16.5,2100,2900,16,13,3.0],
  ['hybrid','하이브리드·우드',132,146,13,17,3000,4200,15,13,3.0],
  ['i4','4번 아이언',126,136,16,19,4200,5200,14,11,3.0],
  ['i5','5번 아이언',116,124,17,20,4700,5700,14,11,3.0],
  ['i6','6번 아이언',107,115,18,21,5100,6200,13,10,3.0],
  ['i7','7번 아이언',98,108,19,22,5700,6900,13,10,3.0],
  ['i8','8번 아이언',88,98,21,24,6300,7600,12,9,3.0],
  ['i9','9번 아이언',79,89,23,26,7000,8300,12,9,3.0],
  ['pw','피칭',70,80,25,28,7800,9000,11,8,2.5],
  ['w48','48도',60,70,27,31,8200,9500,10,8,2.5],
  ['w52','52도',50,60,29,33,8500,10000,9,7,2.5],
  ['w56','56도',40,50,31,36,9000,11000,9,7,2.5]
];

/* ───────────────────────── 화면 ───────────────────────── */

/* 화면은 깃허브 페이지에서 연다. 이 주소는 데이터만 주고받는 창구다. */
var APP_URL = 'https://junkim10293847.github.io/swing-log/';

function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>스윙 로그</title>' +
    '<div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px;margin:18vh auto;padding:0 20px;' +
    'text-align:center;color:#2b2724;line-height:1.7">' +
    '<h1 style="font-size:21px">스윙 로그</h1>' +
    '<p style="color:#6b635c;font-size:14.5px">여기는 데이터 창구입니다. 앱은 아래 주소에서 엽니다.</p>' +
    '<p style="margin-top:22px"><a href="' + APP_URL + '" ' +
    'style="display:inline-block;background:#BF4F19;color:#fff;text-decoration:none;' +
    'padding:13px 22px;border-radius:11px;font-weight:600">앱 열기</a></p></div>')
    .setTitle('스윙 로그')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ───────────────────────── 바깥에서 부르는 창구 ─────────────────────────
 * 깃허브 페이지에 올린 화면이 이 주소로 요청을 보낸다.
 * 배포 권한을 "모든 사용자"로 열어야 하므로, 잠금은 여기서 서버가 직접 지킨다.
 * 토큰이 없으면 데이터 요청은 한 줄도 나가지 않는다.
 */

/** 잠기기 전에도 부를 수 있는 것 — 등록 여부 확인, 등록, 잠금 해제뿐 */
var OPEN_FNS = { apiAuthState: 1, apiSignup: 1, apiLogin: 1 };

function dispatch_(fn) {
  var map = {
    apiAuthState: apiAuthState, apiSignup: apiSignup, apiLogin: apiLogin,
    apiChangePin: apiChangePin, apiLock: apiLock,
    apiLoad: apiLoad, apiSheetUrl: apiSheetUrl,
    apiSaveClub: apiSaveClub, apiDeleteClub: apiDeleteClub,
    apiSaveSession: apiSaveSession, apiDeleteSession: apiDeleteSession,
    apiSaveRound: apiSaveRound, apiDeleteRound: apiDeleteRound,
    apiSetKey: apiSetKey, apiClearKey: apiClearKey,
    apiAsk: apiAsk, apiReadShot: apiReadShot, apiReadClub: apiReadClub
  };
  return map[fn] || null;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: '요청을 읽지 못했습니다.' }); }

  var fn = String(req.fn || '');
  var args = req.args || [];
  var token = String(req.token || '');

  var f = dispatch_(fn);
  if (!f) return json_({ ok: false, error: '알 수 없는 요청입니다: ' + fn });

  /* 이번 요청의 주인을 먼저 정한다. 아래 모든 읽기·쓰기가 이 값에 묶인다. */
  CUR_UID = uidOfToken_(token);
  if (!OPEN_FNS[fn] && !CUR_UID) {
    return json_({ ok: false, locked: true, error: '로그인이 필요합니다.' });
  }
  try {
    var v = f.apply(null, args);
    return json_({ ok: true, value: (v === undefined ? null : v) });
  } catch (err2) {
    return json_({ ok: false, error: (err2 && err2.message) ? err2.message : String(err2) });
  }
}

/* ───────────────────────── 계정 ─────────────────────────
 * 주소를 아는 사람은 누구나 이름과 비밀번호를 정해 자기 기록을 쌓는다. 이름이 곧 로그인 이름이다.
 * 비밀번호는 저장하지 않는다. 사람마다 다른 소금을 섞어 2천 번 해시한 값만 남는다.
 * 기록의 모든 줄에는 주인이 적혀 있고, 서버가 그 줄만 돌려준다.
 */

var PIN_ROUNDS = 2000;
var TOKEN_DAYS = 30;

function pinHash_(salt, pw) {
  var s = salt + '|' + String(pw);
  for (var i = 0; i < PIN_ROUNDS; i++) {
    s = Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s + '|' + i, Utilities.Charset.UTF_8));
  }
  return s;
}

function rand_(n) {
  var out = '';
  while (out.length < n) out += Utilities.getUuid().replace(/-/g, '');
  return out.slice(0, n);
}

function normId_(v) { return String(v || '').trim().toLowerCase(); }

/** 이름이 곧 로그인 이름이다. 대소문자와 앞뒤 공백은 무시하고 찾는다. */
function findUser_(loginId) {
  var want = normId_(loginId);
  if (!want) return null;
  var sh = sheet_(SH.user);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var head = HEAD[SH.user];
  var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (normId_(vals[i][1]) !== want) continue;
    var o = {};
    for (var j = 0; j < head.length; j++) o[head[j]] = vals[i][j];
    o.__row = i + 2;
    return o;
  }
  return null;
}

function userById_(uid) {
  var sh = sheet_(SH.user);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var head = HEAD[SH.user];
  var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) !== String(uid)) continue;
    var o = {};
    for (var j = 0; j < head.length; j++) o[head[j]] = vals[i][j];
    return o;
  }
  return null;
}

/* ── 맞춰보기 제한 ── 이름마다 따로 센다 ── */
function waitLeft_(loginId) {
  var k = 'FAIL_UNTIL_' + normId_(loginId);
  var until = Number(PropertiesService.getScriptProperties().getProperty(k) || 0);
  var left = Math.ceil((until - Date.now()) / 1000);
  return left > 0 ? left : 0;
}
function noteFail_(loginId) {
  var props = PropertiesService.getScriptProperties();
  var id = normId_(loginId);
  var n = Number(props.getProperty('FAIL_N_' + id) || 0) + 1;
  props.setProperty('FAIL_N_' + id, String(n));
  if (n >= 5) {
    var wait = Math.min(60 * Math.pow(2, n - 5), 3600);   /* 1분에서 두 배씩, 최대 1시간 */
    props.setProperty('FAIL_UNTIL_' + id, String(Date.now() + wait * 1000));
    return wait;
  }
  return 0;
}
function clearFail_(loginId) {
  var props = PropertiesService.getScriptProperties();
  var id = normId_(loginId);
  props.deleteProperty('FAIL_N_' + id);
  props.deleteProperty('FAIL_UNTIL_' + id);
}

/* ── 토큰 ── */
function newToken_(uid) {
  var t = rand_(32);
  PropertiesService.getScriptProperties().setProperty('TK_' + t,
    uid + '|' + (Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000));
  return t;
}
function uidOfToken_(token) {
  if (!/^[a-z0-9]{32}$/i.test(String(token || ''))) return '';
  var props = PropertiesService.getScriptProperties();
  var v = props.getProperty('TK_' + token);
  if (!v) return '';
  var bits = String(v).split('|');
  if (Date.now() > Number(bits[1] || 0)) { props.deleteProperty('TK_' + token); return ''; }
  return bits[0] || '';
}

/* ── 바깥에서 부르는 것들 ── */

function apiAuthState(token) {
  var uid = uidOfToken_(token);
  if (!uid) return { unlocked: false, name: '' };
  var u = userById_(uid);
  if (!u) return { unlocked: false, name: '' };
  var nm = u['이름'] || '';
  return { unlocked: true, name: nm, loginId: nm };
}

function apiSignup(name, pw) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 20) throw new Error('이름은 2~20자로 넣어 주세요.');
  if (String(pw || '').length < 4) throw new Error('비밀번호는 4자 이상으로 넣어 주세요.');
  if (findUser_(name)) throw new Error('이미 쓰고 있는 이름입니다. 뒤에 한 글자를 붙이거나 다른 이름으로 해주세요.');

  var uid = uid_('u');
  var salt = rand_(24);
  var saved = CUR_UID; CUR_UID = '';                 /* 사용자 시트에는 주인 칸이 없다 */
  writeRow_(SH.user, {
    id: uid, '이름': name, '솔트': salt, '해시': pinHash_(salt, pw),
    '표시이름': name, '가입일': new Date()
  });
  CUR_UID = saved;

  claimLegacy_(uid);                                  /* 맨 처음 가입한 사람이 기존 기록을 가져간다 */
  CUR_UID = uid;
  seedCfg_(uid);                                      /* 기준값을 이 사람 몫으로 깔아준다 */
  clearFail_(name);
  return { ok: true, name: name, loginId: name, token: newToken_(uid) };
}

function apiLogin(name, pw) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  var left = waitLeft_(name);
  if (left > 0) throw new Error(left + '초 뒤에 다시 넣어 주세요.');
  var u = findUser_(name);
  if (u && pinHash_(u['솔트'], pw) === u['해시']) {
    clearFail_(name);
    return { ok: true, name: u['이름'], loginId: u['이름'], token: newToken_(u.id) };
  }
  var wait = noteFail_(name);
  if (wait) {
    var txt = wait >= 3600 ? '1시간' : (wait >= 60 ? (Math.round(wait / 60) + '분') : (wait + '초'));
    throw new Error('여러 번 틀렸습니다. ' + txt + ' 뒤에 다시 넣어 주세요.');
  }
  /* 이름이 없는 것인지 비밀번호가 틀린 것인지 구분해 주지 않는다 */
  throw new Error('이름이나 비밀번호가 맞지 않습니다.');
}

function apiChangePin(oldPw, newPw) {
  if (!CUR_UID) throw new Error('로그인이 필요합니다.');
  var u = userById_(CUR_UID);
  if (!u || pinHash_(u['솔트'], oldPw) !== u['해시']) throw new Error('지금 비밀번호가 맞지 않습니다.');
  if (String(newPw || '').length < 4) throw new Error('새 비밀번호는 4자 이상으로 넣어 주세요.');
  var salt = rand_(24);
  var saved = CUR_UID; CUR_UID = '';
  writeRow_(SH.user, {
    id: u.id, '이름': u['이름'], '솔트': salt, '해시': pinHash_(salt, newPw),
    '표시이름': u['표시이름'] || u['이름'], '가입일': u['가입일']
  });
  CUR_UID = saved;
  return { ok: true };
}

function apiLock(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('TK_' + token);
  return { ok: true };
}

/** 새 사용자에게 기준값 한 벌을 깔아 준다. */
function seedCfg_(uid) {
  var had = rows_(SH.cfg);
  if (had.length) return;
  CFG_DEFAULT.forEach(function (row) {
    var o = {};
    HEAD[SH.cfg].forEach(function (k, i) { if (i < row.length) o[k] = row[i]; });
    o[OWNER] = uid;
    sheet_(SH.cfg).appendRow(HEAD[SH.cfg].map(function (k) {
      return o[k] === undefined || o[k] === null ? '' : o[k];
    }));
  });
}

/**
 * 비밀번호를 잊은 사람을 위해. 스크립트 편집기에서 직접 실행해야만 된다.
 * 이름을 넣고 실행하면 임시 비밀번호를 만들어 실행 기록에 찍는다.
 */
function resetPassword() {
  var who = '여기에_이름';
  if (who.indexOf('여기에') >= 0) throw new Error('이 함수 안의 who 를 실제 이름으로 바꾼 뒤 실행하세요.');
  var u = findUser_(who);
  if (!u) throw new Error('그런 이름이 없습니다.');
  var tmp = String(Math.floor(100000 + Math.random() * 900000));
  var salt = rand_(24);
  CUR_UID = '';
  writeRow_(SH.user, {
    id: u.id, '이름': u['이름'], '솔트': salt, '해시': pinHash_(salt, tmp),
    '표시이름': u['표시이름'] || u['이름'], '가입일': u['가입일']
  });
  clearFail_(who);
  Logger.log('임시 비밀번호: ' + tmp + ' — 로그인한 뒤 바로 바꾸세요.');
  return '임시 비밀번호: ' + tmp;
}

/* ───────────────────────── 스프레드시트 ───────────────────────── */

function ss_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* 지워졌으면 새로 만든다 */ }
  }
  var active = null;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }
  var made = SpreadsheetApp.create('스윙 로그 데이터');
  props.setProperty('SPREADSHEET_ID', made.getId());
  return made;
}

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEAD[name].length).setValues([HEAD[name]])
      .setFontWeight('bold').setBackground('#efede7');
    sh.setFrozenRows(1);
    if (name === SH.cfg && CFG_DEFAULT.length) {
      sh.getRange(2, 1, CFG_DEFAULT.length, CFG_DEFAULT[0].length).setValues(CFG_DEFAULT);
    }
  }
  var first = ss.getSheets()[0];
  if (first.getName() === 'Sheet1' || first.getName() === '시트1') {
    if (first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  }
  return sh;
}

/** 시트를 전부 만들어 둔다. 스크립트 편집기에서 한 번 직접 실행해도 된다. */
function setup() {
  [SH.user, SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (n) { sheet_(n); });
  [SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (n) { ensureOwnerCol_(n); });
  var url = ss_().getUrl();
  Logger.log('스프레드시트 준비 완료: ' + url);
  return url;
}

/**
 * 예전에 만든 시트에는 주인 칸이 없다. 한 번만 덧붙이고,
 * 이미 들어 있던 줄은 전부 첫 번째 사용자 것으로 넘긴다.
 */
function ensureOwnerCol_(name) {
  var sh = sheet_(name);
  var head = HEAD[name];
  var width = sh.getLastColumn();
  var cur = width ? sh.getRange(1, 1, 1, width).getValues()[0] : [];
  var at = -1;
  for (var i = 0; i < cur.length; i++) if (String(cur[i]) === OWNER) at = i;
  if (at >= 0) return;

  var col = head.length;                       /* 주인 칸은 맨 뒤 */
  sh.getRange(1, col).setValue(OWNER).setFontWeight('bold').setBackground('#efede7');
  var last = sh.getLastRow();
  if (last >= 2) {
    var legacy = PropertiesService.getScriptProperties().getProperty('LEGACY_UID') || '';
    if (legacy) {
      var fill = [];
      for (var r = 0; r < last - 1; r++) fill.push([legacy]);
      sh.getRange(2, col, fill.length, 1).setValues(fill);
    }
  }
}

/** 주인이 없던 줄을 이 사람 것으로 넘긴다. 맨 처음 가입한 사람에게만 한 번. */
function claimLegacy_(uid) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('LEGACY_DONE')) return;
  props.setProperty('LEGACY_UID', uid);
  [SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (name) {
    var sh = sheet_(name);
    var last = sh.getLastRow();
    if (last < 2) return;
    var col = HEAD[name].length;
    var vals = sh.getRange(2, col, last - 1, 1).getValues();
    var changed = false;
    for (var i = 0; i < vals.length; i++) {
      if (vals[i][0] === '' || vals[i][0] === null) { vals[i][0] = uid; changed = true; }
    }
    if (changed) sh.getRange(2, col, vals.length, 1).setValues(vals);
  });
  props.setProperty('LEGACY_DONE', '1');
}

/** 이 사람 줄만 돌려준다. 남의 줄은 애초에 손에 들어오지 않는다. */
function rows_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var head = HEAD[name];
  var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  var oc = head.length - 1;                    /* 주인 칸 위치 */
  var mine = (name !== SH.user) && !!CUR_UID;
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] === null) continue;
    if (mine && String(vals[i][oc]) !== String(CUR_UID)) continue;
    var o = {};
    for (var j = 0; j < head.length; j++) o[head[j]] = vals[i][j];
    o.__row = i + 2;
    out.push(o);
  }
  return out;
}

/** 내 줄에서만 찾는다. 남의 id 를 넣어도 0 이 나온다. */
function findRow_(name, id) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var head = HEAD[name];
  var oc = head.length;
  var vals = sh.getRange(2, 1, last - 1, oc).getValues();
  var mine = (name !== SH.user) && !!CUR_UID;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) !== String(id)) continue;
    if (mine && String(vals[i][oc - 1]) !== String(CUR_UID)) continue;
    return i + 2;
  }
  return 0;
}

function writeRow_(name, obj) {
  var sh = sheet_(name);
  var head = HEAD[name];
  if (name !== SH.user && CUR_UID) obj[OWNER] = CUR_UID;   /* 주인은 서버가 적는다 */
  var line = head.map(function (k) {
    var v = obj[k];
    if (v === undefined || v === null) return '';
    if (v instanceof Date) return v;
    return v;
  });
  var row = obj.id ? findRow_(name, obj.id) : 0;
  if (row) sh.getRange(row, 1, 1, head.length).setValues([line]);
  else sh.appendRow(line);
  return obj.id;
}

function delRow_(name, id) {
  var row = findRow_(name, id);                /* 내 줄이 아니면 0 */
  if (row) sheet_(name).deleteRow(row);
  return true;
}

function uid_(p) {
  return (p || 'x') + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function n_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var x = Number(v);
  return isNaN(x) ? null : x;
}

/* ───────────────────────── 앱이 부르는 함수들 ───────────────────────── */

/** 화면을 처음 열 때 한 번. 전부 내려준다. */
function apiLoad() {
  [SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (n) { ensureOwnerCol_(n); });
  var clubs = rows_(SH.club).map(function (r) {
    return {
      id: r.id, order: n_(r['순서']) || 0, name: r['이름'], cat: r['분류'],
      brand: r['브랜드'], model: r['모델'], loft: n_(r['로프트']),
      shaft: r['샤프트'], flex: r['플렉스'], length: r['길이'],
      bought: r['구입시기'], spare: r['예비'] === true || r['예비'] === 'Y' || r['예비'] === 'y',
      note: r['메모'], spec: r['클럽특성'],
      issues: String(r['점검사항'] || '').split('\n').filter(function (x) { return x.trim(); }),
      drill: r['연습법']
    };
  }).sort(function (a, b) { return a.order - b.order; });

  var shots = rows_(SH.shot);
  var logs = rows_(SH.log);

  var byLog = {};
  shots.forEach(function (r) {
    var k = String(r['연습id'] || r['날짜']);
    (byLog[k] = byLog[k] || []).push({
      id: r.id, clubId: r['클럽id'], clubName: r['클럽명'],
      m: {
        total: n_(r['비거리']), carry: n_(r['캐리']), apex: n_(r['최고높이']),
        ball: n_(r['볼스피드']), launch: n_(r['발사각']), dir: n_(r['방향각']),
        side: n_(r['사이드스핀']), back: n_(r['백스핀']), depth: n_(r['앞뒤편차']),
        width: n_(r['좌우편차']), landing: n_(r['안착률']), grade: r['등급'] || null
      },
      good: String(r['기준안'] || '').split('\n').filter(function (x) { return x.trim(); }),
      bad: String(r['부족한점'] || '').split('\n').filter(function (x) { return x.trim(); }),
      coaching: r['코칭'] || ''
    });
  });

  var sessions = logs.map(function (r) {
    return {
      id: r.id, date: fmtDate_(r['날짜']),
      warmup: String(r['준비운동'] || '').split(',').map(Number).filter(function (x) { return !isNaN(x); }),
      cooldown: String(r['마무리운동'] || '').split(',').map(Number).filter(function (x) { return !isNaN(x); }),
      feeling: r['느낀점'] || '', coaching: r['코칭'] || '',
      blocks: byLog[String(r.id)] || []
    };
  }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

  var rounds = rows_(SH.round).map(function (r) {
    return {
      id: r.id, date: fmtDate_(r['날짜']), type: r['종류'] === '필드' ? 'field' : 'screen',
      course: r['코스'], score: n_(r['스코어']), par: n_(r['파']), putts: n_(r['퍼팅']),
      fw: n_(r['페어웨이']), gir: n_(r['그린적중']), ob: n_(r['OB']), penalty: n_(r['벌타']),
      dbl: n_(r['더블이상']), parOrBetter: n_(r['파이상']), note: r['메모'] || '', analysis: r['분석'] || ''
    };
  }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

  var cfg = {};
  rows_(SH.cfg).forEach(function (r) {
    if (!r['클럽키']) return;
    cfg[String(r['클럽키']).trim()] = {
      label: r['이름'],
      carry: [n_(r['캐리최소']), n_(r['캐리최대'])],
      launch: [n_(r['발사각최소']), n_(r['발사각최대'])],
      back: [n_(r['백스핀최소']), n_(r['백스핀최대'])],
      width: [0, n_(r['좌우편차최대'])],
      depth: [0, n_(r['앞뒤편차최대'])],
      dir: n_(r['방향각허용'])
    };
  });

  return {
    clubs: clubs, sessions: sessions, rounds: rounds, cfg: cfg,
    hasAI: !!PropertiesService.getScriptProperties().getProperty('GEMINI_KEY'),
    userName: (function () { var u = userById_(CUR_UID); return u ? (u['이름'] || '') : ''; })(),
    sheetUrl: ss_().getUrl()
  };
}

function fmtDate_(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  }
  return String(v);
}

function apiSaveClub(c) {
  if (!c.id) c.id = uid_('c');
  writeRow_(SH.club, {
    id: c.id, '순서': c.order || 0, '이름': c.name || '', '분류': c.cat || 'iron',
    '브랜드': c.brand || '', '모델': c.model || '', '로프트': c.loft == null ? '' : c.loft,
    '샤프트': c.shaft || '', '플렉스': c.flex || '', '길이': c.length || '',
    '구입시기': c.bought || '', '예비': c.spare ? 'Y' : '', '메모': c.note || '',
    '클럽특성': c.spec || '', '점검사항': (c.issues || []).join('\n'), '연습법': c.drill || ''
  });
  return c.id;
}
function apiDeleteClub(id) { return delRow_(SH.club, id); }

function apiSaveSession(s) {
  if (!s.id) s.id = uid_('s');
  writeRow_(SH.log, {
    id: s.id, '날짜': s.date, '준비운동': (s.warmup || []).join(','),
    '마무리운동': (s.cooldown || []).join(','), '느낀점': s.feeling || '',
    '코칭': s.coaching || '', '기록시각': new Date()
  });
  /* 이 연습에 달린 기존 샷 줄을 지우고 다시 쓴다 */
  var sh = sheet_(SH.shot);
  var existing = rows_(SH.shot).filter(function (r) { return String(r['연습id']) === String(s.id); });
  for (var i = existing.length - 1; i >= 0; i--) sh.deleteRow(existing[i].__row);

  (s.blocks || []).forEach(function (b) {
    var m = b.m || {};
    writeRow_(SH.shot, {
      id: b.id || uid_('b'), '연습id': s.id, '날짜': s.date, '클럽id': b.clubId || '', '클럽명': b.clubName || '',
      '비거리': m.total == null ? '' : m.total, '캐리': m.carry == null ? '' : m.carry,
      '최고높이': m.apex == null ? '' : m.apex, '볼스피드': m.ball == null ? '' : m.ball,
      '발사각': m.launch == null ? '' : m.launch, '방향각': m.dir == null ? '' : m.dir,
      '사이드스핀': m.side == null ? '' : m.side, '백스핀': m.back == null ? '' : m.back,
      '앞뒤편차': m.depth == null ? '' : m.depth, '좌우편차': m.width == null ? '' : m.width,
      '안착률': m.landing == null ? '' : m.landing, '등급': m.grade || '',
      '기준안': (b.good || []).join('\n'), '부족한점': (b.bad || []).join('\n'), '코칭': b.coaching || ''
    });
  });
  return s.id;
}
function apiDeleteSession(id) {
  var sh = sheet_(SH.shot);
  var kids = rows_(SH.shot).filter(function (r) { return String(r['연습id']) === String(id); });
  for (var i = kids.length - 1; i >= 0; i--) sh.deleteRow(kids[i].__row);
  return delRow_(SH.log, id);
}

function apiSaveRound(r) {
  if (!r.id) r.id = uid_('r');
  writeRow_(SH.round, {
    id: r.id, '날짜': r.date, '종류': r.type === 'field' ? '필드' : '스크린', '코스': r.course || '',
    '스코어': r.score == null ? '' : r.score, '파': r.par == null ? '' : r.par,
    '퍼팅': r.putts == null ? '' : r.putts, '페어웨이': r.fw == null ? '' : r.fw,
    '그린적중': r.gir == null ? '' : r.gir, 'OB': r.ob == null ? '' : r.ob,
    '벌타': r.penalty == null ? '' : r.penalty, '더블이상': r.dbl == null ? '' : r.dbl,
    '파이상': r.parOrBetter == null ? '' : r.parOrBetter,
    '메모': r.note || '', '분석': r.analysis || ''
  });
  return r.id;
}
function apiDeleteRound(id) { return delRow_(SH.round, id); }

/* ───────────────────────── AI (선택) ───────────────────────── */

/**
 * 제미나이 API 키를 저장한다. 스크립트 편집기에서 한 번 실행하면 된다.
 * 키는 https://aistudio.google.com/apikey 에서 무료로 발급받는다.
 */
function setGeminiKey() {
  var key = 'AI_여기에_키를_붙여넣으세요';
  if (key.indexOf('여기에') >= 0) throw new Error('이 함수 안의 key 값을 실제 키로 바꾼 뒤 실행하세요.');
  PropertiesService.getScriptProperties().setProperty('GEMINI_KEY', key);
  return '저장했습니다.';
}

/* ====================== 제미나이 ======================
 * 모델 이름은 고정하지 않는다. 계정에서 실제로 쓸 수 있는 모델을 한 번 조회해
 * 기억해 두고, 그 모델이 사라지면 다시 고른다. 이름이 바뀌어도 멈추지 않는다.
 */

function key_() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_KEY') || '';
}

/** 쓸 수 있는 모델 목록을 받아 보기 좋은 순서로 돌려준다. */
function listModels_(key) {
  var res = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(key),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return [];
  var j = {};
  try { j = JSON.parse(res.getContentText()); } catch (e) { return []; }
  var names = [];
  (j.models || []).forEach(function (m) {
    var ms = m.supportedGenerationMethods || m.supportedActions || [];
    if (ms.length && ms.indexOf('generateContent') < 0) return;
    var n = String(m.name || '').replace(/^models\//, '');
    if (!n) return;
    if (/embedding|aqa|imagen|veo|tts|live|image-generation/.test(n)) return;
    names.push(n);
  });
  function score(n) {
    var v = 0;
    var mv = /([0-9]+)\.([0-9]+)/.exec(n);
    if (mv) v += (parseInt(mv[1], 10) * 100 + parseInt(mv[2], 10)) * 10;
    if (/flash/.test(n)) v += 40;        /* 빠르고 싸다 */
    if (/lite/.test(n)) v -= 25;
    if (/pro/.test(n)) v += 10;
    if (/preview|exp/.test(n)) v -= 15;  /* 실험판은 뒤로 */
    if (/latest/.test(n)) v += 5;
    return v;
  }
  names.sort(function (a, b) { return score(b) - score(a); });
  return names;
}

/** 쓸 모델들을 순위대로. 목록은 하루 기억한다. */
function models_(refresh) {
  var props = PropertiesService.getScriptProperties();
  var forced = props.getProperty('GEMINI_MODEL');
  if (forced) return [forced];

  var cached = props.getProperty('GEMINI_MODELS');
  var when = Number(props.getProperty('GEMINI_MODELS_AT') || 0);
  if (!refresh && cached && (Date.now() - when) < 24 * 60 * 60 * 1000) {
    try {
      var arr = JSON.parse(cached);
      if (arr && arr.length) return arr;
    } catch (e) {}
  }
  var names = listModels_(key_());
  if (!names.length) names = ['gemini-flash-latest'];
  names = names.slice(0, 6);
  props.setProperty('GEMINI_MODELS', JSON.stringify(names));
  props.setProperty('GEMINI_MODELS_AT', String(Date.now()));
  return names;
}

/** 먼저 쓸 모델. 지난번에 통한 모델이 있으면 그것부터. */
function model_(refresh) {
  var props = PropertiesService.getScriptProperties();
  var forced = props.getProperty('GEMINI_MODEL');
  if (forced && !refresh) return forced;
  var ok = props.getProperty('GEMINI_MODEL_OK');
  if (ok && !refresh) return ok;
  return models_(refresh)[0];
}

function callModel_(name, parts, key) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + name +
            ':generateContent?key=' + encodeURIComponent(key);
  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: parts }],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 }
    })
  });
}

function errMsg_(body) {
  try { return (JSON.parse(body).error || {}).message || ''; } catch (e) { return ''; }
}

/**
 * 혼잡(429·500·503)은 흔하다. 같은 모델을 한 번 더 두드려 보고,
 * 그래도 안 되면 다음 모델로 넘어간다. 한 모델이 막혔다고 멈추지 않는다.
 */
function gemini_(parts) {
  var key = key_();
  if (!key) {
    throw new Error('AI 키가 아직 없습니다. 앱 화면의 키 입력란에 제미나이 키를 넣어 주세요. ' +
                    '키 없이도 기준 판정과 비교는 그대로 동작합니다.');
  }
  var props = PropertiesService.getScriptProperties();
  var list = models_(false).slice();
  var first = props.getProperty('GEMINI_MODEL_OK');
  if (first) {
    var at = list.indexOf(first);
    if (at > 0) list.splice(at, 1);
    if (at !== 0) list.unshift(first);
  }

  var busy = [];      /* 혼잡으로 비킨 모델 */
  var lastMsg = '';

  /* 사진이 붙은 호출은 한 번이 무겁다. 모델을 많이 돌면 사용자가 하염없이 기다린다. */
  var heavy = false;
  for (var pi = 0; pi < parts.length; pi++) if (parts[pi] && parts[pi].inline_data) heavy = true;
  var maxModels = heavy ? 2 : 4;
  var napMs = heavy ? 1200 : 1800;

  for (var i = 0; i < list.length && i < maxModels; i++) {
    var name = list[i];
    for (var tryNo = 0; tryNo < 2; tryNo++) {
      var res = callModel_(name, parts, key);
      var code = res.getResponseCode();
      var body = res.getContentText();

      if (code === 200) {
        var j = JSON.parse(body);
        var c = j.candidates && j.candidates[0];
        if (c && c.finishReason === 'SAFETY') throw new Error('이 사진은 처리하지 못했습니다. 다시 찍어 주세요.');
        var t = c && c.content && c.content.parts &&
                c.content.parts.map(function (p) { return p.text || ''; }).join('');
        if (t) {
          props.setProperty('GEMINI_MODEL_OK', name);
          return t.trim();
        }
        lastMsg = '답이 비어 있었습니다';
        break;                                  /* 다음 모델로 */
      }

      var msg = errMsg_(body);
      lastMsg = code + ' ' + msg;

      /* 혼잡·일시 오류 — 잠깐 쉬고 한 번 더, 그래도 안 되면 다음 모델 */
      if (code === 429 || code === 500 || code === 503) {
        if (tryNo === 0) { Utilities.sleep(napMs); continue; }
        busy.push(name);
        break;
      }
      /* 모델이 없어졌다 — 목록을 새로 받고 다음 모델 */
      if (code === 404) { models_(true); break; }
      /* 키 문제는 모델을 바꿔도 소용없다 */
      if (code === 403) throw new Error('키 권한 문제입니다. ' + (msg || '키를 다시 발급해 보세요.'));
      if (code === 400 && /API key|API_KEY/i.test(msg)) throw new Error('키가 올바르지 않습니다. 다시 넣어 주세요.');
      if (code === 400) throw new Error('요청이 거부됐습니다. ' + msg);
      break;                                    /* 그 밖의 오류 — 다음 모델 */
    }
  }

  if (busy.length) {
    throw new Error('지금 구글 쪽 모델이 혼잡합니다(' + busy.join(', ') + '). ' +
                    '1~2분 뒤 다시 눌러 주세요. 급하면 아래 칸에 직접 넣으셔도 됩니다.');
  }
  throw new Error('읽어내지 못했습니다. ' + lastMsg);
}

/**
 * 앱 화면에서 키를 저장한다. 저장 전에 실제로 되는지 확인하고,
 * 안 되면 저장하지 않고 이유를 돌려준다.
 */
function apiSetKey(key) {
  key = String(key || '').trim();
  if (!key) throw new Error('키가 비어 있습니다.');
  if (key.length < 20) throw new Error('키가 너무 짧습니다. 전체를 붙여넣었는지 확인하세요.');
  var names = listModels_(key);
  if (!names.length) throw new Error('이 키로는 모델 목록을 못 받았습니다. 키가 잘못됐거나 Generative Language API가 꺼져 있습니다.');
  var props = PropertiesService.getScriptProperties();
  props.setProperty('GEMINI_KEY', key);
  props.deleteProperty('GEMINI_MODEL_OK');
  props.deleteProperty('GEMINI_MODELS');
  var pick = models_(true)[0];
  /* 실제로 한 번 돌려 보되, 모델 혼잡으로 실패한 것까지 키 탓으로 돌리지 않는다.
     모델 목록을 받아낸 시점에서 키 자체는 이미 유효하다. */
  try {
    gemini_([{ text: '한 단어로만 답하세요: 골프' }]);
    return { ok: true, model: props.getProperty('GEMINI_MODEL_OK') || pick };
  } catch (e) {
    return { ok: true, model: pick, warn: e.message };
  }
}

/** 저장된 키를 지운다. */
function apiClearKey() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('GEMINI_KEY');
  props.deleteProperty('GEMINI_MODEL_OK');
  return { ok: true };
}

/**
 * 편집기에서 직접 실행해 AI가 되는지 확인한다.
 * 실행 기록에 결과가 그대로 찍힌다.
 */
function testAI() {
  var out = [];
  var key = key_();
  out.push(key ? ('키: 있음 (' + key.length + '자)') : '키: 없음 → setGeminiKey 를 먼저 실행하세요');
  if (!key) { Logger.log(out.join('\n')); return out.join('\n'); }
  var names = listModels_(key);
  out.push('쓸 수 있는 모델: ' + (names.length ? names.slice(0, 8).join(', ') : '조회 실패 — 키가 잘못됐을 수 있습니다'));
  var order = models_(true);
  out.push('시도 순서: ' + order.join(' → '));
  try {
    var t = gemini_([{ text: '한 단어로만 답하세요: 골프' }]);
    out.push('응답: ' + t);
    out.push('→ 사진 판독을 쓸 수 있습니다.');
  } catch (e) {
    out.push('실패: ' + e.message);
  }
  var r = out.join('\n');
  Logger.log(r);
  return r;
}

/** 글로 답을 받는다. */
function apiAsk(prompt) {
  return gemini_([{ text: prompt }]);
}

/** 측정 화면 사진에서 숫자를 읽는다. dataUrl 은 "data:image/jpeg;base64,..." */
function apiReadShot(dataUrl) {
  var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('사진을 읽을 수 없는 형식입니다.');
  var prompt =
    '골프 연습장 스윙 측정기(골프존·카카오VX 등)의 결과 화면을 찍은 사진이다.\n' +
    '화면에 적힌 글자와 숫자만 근거로 읽어라. 보이지 않는 항목은 null 로 둔다. 어림짐작하지 마라.\n' +
    '여러 발의 평균을 보여주는 화면이면 평균값을 읽는다. 표가 있으면 평균 행을 읽는다.\n' +
    '\n' +
    '읽을 항목과 화면에서 흔히 쓰는 이름:\n' +
    '- club : 어떤 클럽인지. 화면에 적힌 대로 (예 "7I", "#7", "7번", "DR", "W1", "56", "56°", "SW", "UT", "3H")\n' +
    '- shots : 친 발수 (예 "10회", "15 shots")\n' +
    '- total : 비거리 / 총거리 / Total (m)\n' +
    '- carry : 캐리 / 캐리거리 / Carry (m)\n' +
    '- apex : 최고높이 / 최고점 / Apex (m)\n' +
    '- ball : 볼스피드 / 볼 스피드 / Ball Speed (m/s)\n' +
    '- launch : 발사각 / 런치각 / Launch (도)\n' +
    '- dir : 방향각 / 출발각 / Direction. L 또는 R 과 숫자를 붙여 그대로 (예 "L4.0", "R1.2")\n' +
    '- side : 사이드스핀 / Side Spin. L·R 을 붙여 그대로 (예 "L282", "R415")\n' +
    '- back : 백스핀 / Back Spin (rpm)\n' +
    '- depth : 앞뒤 편차 / 앞뒤 차이 (m)\n' +
    '- width : 좌우 편차 / 좌우 차이 (m)\n' +
    '- landing : 안착률 (%의 숫자만)\n' +
    '- grade : 등급 (A·B·C·D 중 하나)\n' +
    '\n' +
    '거리 단위가 야드(yd)로 적혀 있으면 미터로 바꿔 넣고 unit 에 "yd" 를 넣어라. 미터면 unit 은 "m".\n' +
    '아래 JSON 하나만 출력하라. 설명 문장, 코드 울타리 모두 쓰지 마라.\n' +
    '{"club":null,"shots":null,"total":null,"carry":null,"apex":null,"ball":null,"launch":null,' +
    '"dir":null,"side":null,"back":null,"depth":null,"width":null,"landing":null,"grade":null,"unit":"m"}';
  var txt = gemini_([
    { text: prompt },
    { inline_data: { mime_type: m[1], data: m[2] } }
  ]);
  return pickJson_(txt);
}

/** 클럽 사진에서 스펙을 읽는다. */
function apiReadClub(dataUrl) {
  var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('사진을 읽을 수 없는 형식입니다.');
  var txt = gemini_([
    { text: '골프 클럽 사진입니다. 보이는 각인과 라벨만 근거로 JSON 하나로만 답하세요. 읽을 수 없는 항목은 null. 추측하지 마세요.\n' +
            '{"name":"가방에서 부를 이름","cat":"driver|wood|hybrid|iron|wedge|putter","brand":"브랜드","model":"모델명",' +
            '"loft":숫자 또는 null,"shaft":"샤프트 이름","flex":"R|SR|S|X 등","length":"인치 또는 null","note":"눈에 보이는 특이사항"}' },
    { inline_data: { mime_type: m[1], data: m[2] } }
  ]);
  return pickJson_(txt);
}

function pickJson_(t) {
  var s = String(t).trim();
  var fence = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  if (fence) s = fence[1].trim();
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.substring(a, b + 1);
  try { return JSON.parse(s); }
  catch (e) { throw new Error('사진에서 숫자를 읽지 못했습니다. 화면이 또렷하게 나오도록 다시 찍거나 직접 입력하세요.'); }
}

/** 시트 주소를 알려준다. */
function apiSheetUrl() { return ss_().getUrl(); }
