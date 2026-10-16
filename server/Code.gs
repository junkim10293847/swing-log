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
HEAD[SH.club]  = ['id','순서','이름','분류','브랜드','모델','로프트','샤프트','플렉스','길이','구입시기','예비','메모','클럽특성','점검사항','연습법','문답'];
HEAD[SH.shot]  = ['id','연습id','날짜','클럽id','클럽명','비거리','캐리','최고높이','볼스피드','발사각','방향각','사이드스핀','백스핀','앞뒤편차','좌우편차','안착률','등급','기준안','부족한점','코칭'];
HEAD[SH.log]   = ['id','날짜','준비운동','마무리운동','느낀점','코칭','기록시각'];
HEAD[SH.round] = ['id','날짜','종류','코스','스코어','파','퍼팅','페어웨이','그린적중','OB','벌타','더블이상','파이상','홀별','홀파','메모','분석'];
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
    apiAsk: apiAsk, apiReadShot: apiReadShot, apiReadClub: apiReadClub,
    apiReadRound: apiReadRound
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
  CUR_UID = uidOfToken_(token) || openUid_();
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
  /* 예전 버전으로 가입한 줄은 2번 칸이 영문 아이디이고 5번 칸이 이름이다.
     둘 중 어느 쪽으로 넣어도 들어오게 한다. */
  var alt = null;
  for (var i = 0; i < vals.length; i++) {
    var o = {};
    for (var j = 0; j < head.length; j++) o[head[j]] = vals[i][j];
    o.__row = i + 2;
    if (normId_(vals[i][1]) === want) return o;
    if (!alt && normId_(vals[i][4]) === want) alt = o;
  }
  return alt;
}

/**
 * 누가 등록돼 있는지 본다. 스크립트 편집기에서 실행하면 실행 기록에 찍힌다.
 * 비밀번호는 알아볼 수 없는 값이라 여기 나오지 않는다.
 */
function listUsers() {
  var sh = sheet_(SH.user), last = sh.getLastRow();
  if (last < 2) { Logger.log('등록된 사람이 없습니다.'); return '등록된 사람이 없습니다.'; }
  var head = HEAD[SH.user];
  var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  var lines = vals.map(function (r, i) {
    return (i + 1) + '. 로그인 이름 "' + r[1] + '"' +
      (r[4] && String(r[4]) !== String(r[1]) ? (' / 표시 이름 "' + r[4] + '"') : '') +
      ' / 가입 ' + (r[5] ? fmtDate_(r[5]) : '-') + ' / id ' + r[0];
  });
  var txt = lines.join('\n');
  Logger.log(txt);
  return txt;
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

/**
 * 비번 없이 바로 들어가는 모드.
 * 켜 두면 주소를 연 사람은 누구나 그 계정으로 들어온다.
 * 혼자 쓰는 동안만 쓰고, 다른 사람이 생기면 lockMode 로 되돌린다.
 */
function openUid_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('OPEN_MODE') !== '1') return '';
  var pinned = props.getProperty('OPEN_UID');
  if (pinned) return pinned;
  var sh = sheet_(SH.user), last = sh.getLastRow();
  if (last < 2) return '';
  return String(sh.getRange(2, 1).getValue() || '');   /* 첫 번째 사용자 */
}

/** 비번 없이 들어가게 한다. 편집기에서 실행. */
function openMode() {
  var props = PropertiesService.getScriptProperties();
  var sh = sheet_(SH.user), last = sh.getLastRow();
  if (last < 2) throw new Error('등록된 사용자가 없습니다. 앱에서 먼저 하나 만드세요.');
  var id = String(sh.getRange(2, 1).getValue() || '');
  var nm = String(sh.getRange(2, 2).getValue() || '');
  props.setProperty('OPEN_MODE', '1');
  props.setProperty('OPEN_UID', id);
  var txt = '비번 없이 들어가게 했습니다. "' + nm + '" 계정으로 바로 열립니다.\n' +
            '주소를 아는 사람은 누구나 이 기록을 보고 고칠 수 있습니다. ' +
            '되돌리려면 lockMode 를 실행하세요.';
  Logger.log(txt); return txt;
}

/** 다시 비번을 받게 한다. */
function lockMode() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('OPEN_MODE');
  props.deleteProperty('OPEN_UID');
  var txt = '다시 이름과 비밀번호를 받습니다.';
  Logger.log(txt); return txt;
}

function apiAuthState(token) {
  var open = openUid_();
  if (open) {
    var ou = userById_(open);
    return { unlocked: true, open: true, name: ou ? (ou['이름'] || '') : '', loginId: ou ? (ou['이름'] || '') : '' };
  }
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
 * 시트에 이미 쌓여 있는 기록을 한 사람 것으로 몰아 준다.
 * 아래 who 를 실제 이름으로 바꾸고 스크립트 편집기에서 실행하면 된다.
 *
 * 주인이 비어 있는 줄만 넘긴다. 이미 누군가의 것으로 되어 있는 줄은 건드리지 않는다.
 * 남의 기록까지 가져오고 싶지 않을 것이므로, 그 편이 안전하다.
 */
function giveAllTo() {
  var who = '여기에_이름';
  if (who.indexOf('여기에') >= 0) throw new Error('이 함수 안의 who 를 실제 이름으로 바꾼 뒤 실행하세요.');
  var u = findUser_(who);
  if (!u) throw new Error('그런 이름이 없습니다. 앱에서 먼저 등록하세요.');

  [SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (n) { ensureOwnerCol_(n); });

  var moved = {}, total = 0;
  [SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (name) {
    var sh = sheet_(name);
    var last = sh.getLastRow();
    moved[name] = 0;
    if (last < 2) return;
    var col = HEAD[name].length;
    var vals = sh.getRange(2, col, last - 1, 1).getValues();
    var changed = false;
    for (var i = 0; i < vals.length; i++) {
      if (vals[i][0] === '' || vals[i][0] === null) {
        vals[i][0] = u.id; moved[name]++; total++; changed = true;
      }
    }
    if (changed) sh.getRange(2, col, vals.length, 1).setValues(vals);
  });

  PropertiesService.getScriptProperties().setProperty('LEGACY_DONE', '1');
  var txt = who + ' 님에게 ' + total + '줄을 넘겼습니다. — ' +
    Object.keys(moved).map(function (k) { return k + ' ' + moved[k]; }).join(', ');
  Logger.log(txt);
  return txt;
}

/** 누가 몇 줄을 갖고 있는지 한눈에 본다. */
function whoHasWhat() {
  var users = {};
  var sh = sheet_(SH.user), last = sh.getLastRow();
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) { users[r[0]] = r[1]; });
  }
  var out = [];
  [SH.club, SH.shot, SH.log, SH.round].forEach(function (name) {
    var s2 = sheet_(name), l2 = s2.getLastRow();
    if (l2 < 2) { out.push(name + ': 비어 있음'); return; }
    var col = HEAD[name].length;
    var tally = {};
    s2.getRange(2, col, l2 - 1, 1).getValues().forEach(function (r) {
      var k = r[0] === '' || r[0] === null ? '(주인 없음)' : (users[r[0]] || r[0]);
      tally[k] = (tally[k] || 0) + 1;
    });
    out.push(name + ': ' + Object.keys(tally).map(function (k) { return k + ' ' + tally[k] + '줄'; }).join(', '));
  });
  var txt = out.join('\n');
  Logger.log(txt);
  return txt;
}

/**
 * 로그인이 안 될 때 쓰는 복구 함수. 스크립트 편집기에서 직접 실행해야만 된다.
 * 재배포는 필요 없다. 편집기에서 실행하는 함수는 저장만 하면 바로 돈다.
 *
 * 1) who  — 사용자 시트 B열에 적힌 이름을 그대로
 * 2) newPw — 쓰고 싶은 비밀번호. 비워 두면 임시 숫자 6자리를 만들어 준다
 */
function resetPassword() {
  var who   = '여기에_이름';
  var newPw = '';

  if (who.indexOf('여기에') >= 0) throw new Error('이 함수 안의 who 를 실제 이름으로 바꾼 뒤 실행하세요.');
  var u = findUser_(who);
  if (!u) {
    throw new Error('"' + who + '" 이라는 이름이 없습니다. listUsers 를 실행해 실제 이름을 확인하세요.');
  }
  var pw = String(newPw || '');
  if (!pw) pw = String(Math.floor(100000 + Math.random() * 900000));
  if (pw.length < 4) throw new Error('비밀번호는 4자 이상이어야 합니다.');

  var salt = rand_(24);
  CUR_UID = '';
  writeRow_(SH.user, {
    id: u.id, '이름': u['이름'], '솔트': salt, '해시': pinHash_(salt, pw),
    '표시이름': u['표시이름'] || u['이름'], '가입일': u['가입일']
  });
  clearFail_(u['이름']);
  clearFail_(who);
  var txt = '"' + u['이름'] + '" 의 비밀번호를 "' + pw + '" 로 바꿨습니다. 잠금 횟수도 지웠습니다.';
  Logger.log(txt);
  return txt;
}

/**
 * 계정을 하나만 남기고 전부 정리한다. 기록은 남길 계정으로 몰아 준다.
 *
 * 되돌릴 수 없다. 아래 keep 을 남길 이름으로 바꾸고 한 번만 실행하세요.
 * 실행 전에 listUsers 로 이름을 정확히 확인하는 편이 안전합니다.
 */
function keepOnly() {
  var keep = '여기에_남길_이름';
  if (keep.indexOf('여기에') >= 0) throw new Error('이 함수 안의 keep 을 남길 이름으로 바꾼 뒤 실행하세요.');

  var me = findUser_(keep);
  if (!me) throw new Error('"' + keep + '" 이라는 이름이 없습니다. listUsers 로 확인하세요.');

  [SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (n) { ensureOwnerCol_(n); });

  /* 1) 모든 기록을 남길 사람 것으로 — 주인이 비어 있든 남의 것이든 전부 */
  var moved = 0;
  [SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (name) {
    var sh = sheet_(name), last = sh.getLastRow();
    if (last < 2) return;
    var col = HEAD[name].length;
    var vals = sh.getRange(2, col, last - 1, 1).getValues();
    var changed = false;
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) !== String(me.id)) { vals[i][0] = me.id; moved++; changed = true; }
    }
    if (changed) sh.getRange(2, col, vals.length, 1).setValues(vals);
  });

  /* 2) 다른 계정 줄 삭제 — 아래에서 위로 지워야 번호가 밀리지 않는다 */
  var ush = sheet_(SH.user), ulast = ush.getLastRow(), removed = [];
  if (ulast >= 2) {
    var urows = ush.getRange(2, 1, ulast - 1, 2).getValues();
    for (var r = urows.length - 1; r >= 0; r--) {
      if (String(urows[r][0]) === String(me.id)) continue;
      removed.push(urows[r][1]);
      ush.deleteRow(r + 2);
    }
  }

  /* 3) 지운 계정의 로그인 증표와 잠금 기록도 치운다 */
  var props = PropertiesService.getScriptProperties();
  props.getKeys().forEach(function (k) {
    if (k.indexOf('TK_') === 0) {
      var uidOf = String(props.getProperty(k) || '').split('|')[0];
      if (uidOf !== me.id) props.deleteProperty(k);
    }
    if (k.indexOf('FAIL_N_') === 0 || k.indexOf('FAIL_UNTIL_') === 0) props.deleteProperty(k);
  });
  props.setProperty('LEGACY_UID', me.id);
  props.setProperty('LEGACY_DONE', '1');

  /* 4) 기준값이 없으면 한 벌 깔아 준다 */
  CUR_UID = me.id;
  seedCfg_(me.id);

  var txt = '"' + me['이름'] + '" 하나만 남겼습니다.\n' +
    '기록 ' + moved + '줄을 넘겼습니다.\n' +
    (removed.length ? ('지운 계정: ' + removed.join(', ')) : '지울 계정이 없었습니다.');
  Logger.log(txt);
  return txt;
}

/**
 * 특정 모델이 계속 혼잡하면 다른 모델로 고정한다.
 * testPhotoSpeed 나 listModels_ 로 이름을 확인한 뒤 아래 pick 에 적고 실행하세요.
 * 빈 문자열로 두고 실행하면 고정을 풀고 다시 자동으로 고릅니다.
 */
function useModel() {
  var pick = '';
  var props = PropertiesService.getScriptProperties();
  if (!pick) {
    props.deleteProperty('GEMINI_MODEL');
    props.deleteProperty('GEMINI_MODEL_OK');
    props.deleteProperty('GEMINI_MODELS');
    var txt0 = '모델 고정을 풀었습니다. 쓸 수 있는 모델: ' + listModels_(key_()).slice(0, 8).join(', ');
    Logger.log(txt0); return txt0;
  }
  props.setProperty('GEMINI_MODEL', pick);
  props.deleteProperty('BUSY_' + pick);
  var txt = '"' + pick + '" 로 고정했습니다.';
  Logger.log(txt); return txt;
}

/** 혼잡 표시를 전부 지운다. */
function clearBusy() {
  var props = PropertiesService.getScriptProperties(), n = 0;
  props.getKeys().forEach(function (k) {
    if (k.indexOf('BUSY_') === 0 || k.indexOf('NOTHINK_') === 0) { props.deleteProperty(k); n++; }
  });
  props.deleteProperty('GEMINI_MODEL_OK');
  props.deleteProperty('GEMINI_MODEL_OK_IMG');
  props.deleteProperty('GEMINI_MODEL_OK_TXT');
  var txt = '혼잡·설정 표시 ' + n + '개를 지웠습니다. 모델 선택도 처음으로 돌렸습니다.';
  Logger.log(txt); return txt;
}

/** 잠긴 것만 풀고 비밀번호는 그대로 둔다. */
function unlockAll() {
  var props = PropertiesService.getScriptProperties();
  var n = 0;
  props.getKeys().forEach(function (k) {
    if (k.indexOf('FAIL_N_') === 0 || k.indexOf('FAIL_UNTIL_') === 0) { props.deleteProperty(k); n++; }
  });
  var txt = '잠금 기록 ' + n + '개를 지웠습니다. 바로 다시 시도할 수 있습니다.';
  Logger.log(txt);
  return txt;
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
/**
 * 이미 쓰고 있는 시트에 HEAD 에만 있는 칸을 끼워 넣는다.
 * 칸을 끼우면 그 자리 오른쪽 값이 통째로 밀리므로 옛 줄도 어긋나지 않는다.
 * 한 번 끝내면 기록을 남겨 두고 다시 보지 않는다.
 */
var SCHEMA_V = 'round-holes-2';
function migrate_() {
  var pr = PropertiesService.getScriptProperties();
  if (pr.getProperty('SCHEMA_DONE') === SCHEMA_V) return;
  ensureCols_(SH.round);
  ensureCols_(SH.club);
  pr.setProperty('SCHEMA_DONE', SCHEMA_V);
}
function ensureCols_(name) {
  var sh = sheet_(name);
  var head = HEAD[name];
  var width = sh.getLastColumn();
  if (!width) return;
  var cur = sh.getRange(1, 1, 1, width).getValues()[0].map(function (v) { return String(v); });
  for (var i = 0; i < head.length; i++) {
    if (cur.indexOf(head[i]) >= 0) continue;
    sh.insertColumnBefore(i + 1);
    sh.getRange(1, i + 1).setValue(head[i]).setFontWeight('bold').setBackground('#efede7');
    cur.splice(i, 0, head[i]);
  }
}

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
  var oc = head.indexOf(OWNER);                /* 주인 칸 위치 — 이름으로 찾는다 */
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
/** 시트 한 칸에 담긴 문답을 목록으로 되돌린다. 깨져 있으면 빈 목록. */
function qaList_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return [];
  try {
    var a = JSON.parse(s);
    if (!a || !a.length) return [];
    return a.filter(function (x) { return x && x.q; }).slice(-5);
  } catch (e) { return []; }
}

function apiLoad() {
  [SH.club, SH.shot, SH.log, SH.round, SH.cfg].forEach(function (n) { ensureOwnerCol_(n); });
  migrate_();
  var clubs = rows_(SH.club).map(function (r) {
    return {
      id: r.id, order: n_(r['순서']) || 0, name: r['이름'], cat: r['분류'],
      brand: r['브랜드'], model: r['모델'], loft: n_(r['로프트']),
      shaft: r['샤프트'], flex: r['플렉스'], length: r['길이'],
      bought: r['구입시기'], spare: r['예비'] === true || r['예비'] === 'Y' || r['예비'] === 'y',
      note: r['메모'], spec: r['클럽특성'],
      issues: String(r['점검사항'] || '').split('\n').filter(function (x) { return x.trim(); }),
      drill: r['연습법'], qa: qaList_(r['문답'])
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
      dbl: n_(r['더블이상']), parOrBetter: n_(r['파이상']),
      holes: strList_(r['홀별']), pars: strList_(r['홀파']),
      note: r['메모'] || '', analysis: r['분석'] || ''
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
  migrate_();
  writeRow_(SH.club, {
    id: c.id, '순서': c.order || 0, '이름': c.name || '', '분류': c.cat || 'iron',
    '브랜드': c.brand || '', '모델': c.model || '', '로프트': c.loft == null ? '' : c.loft,
    '샤프트': c.shaft || '', '플렉스': c.flex || '', '길이': c.length || '',
    '구입시기': c.bought || '', '예비': c.spare ? 'Y' : '', '메모': c.note || '',
    '클럽특성': c.spec || '', '점검사항': (c.issues || []).join('\n'), '연습법': c.drill || '',
    '문답': (c.qa && c.qa.length) ? JSON.stringify(c.qa.slice(-5)) : ''
  });
  return c.id;
}
function apiDeleteClub(id) { return delRow_(SH.club, id); }

/**
 * 같은 분류의 클럽에 구입 시기를 한 번에 적는다.
 * 아래 cat 과 when 두 줄만 고쳐 편집기에서 실행한다. 재배포는 필요 없다.
 * cat: driver | wood | hybrid | iron | wedge | putter  (전부면 'all')
 */
function setBought() {
  var cat  = 'iron';
  var when = '2026년 6월 7일';

  var sh = sheet_(SH.club);
  var last = sh.getLastRow();
  if (last < 2) return '클럽이 없습니다.';
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var cCat = head.indexOf('분류') + 1, cWhen = head.indexOf('구입시기') + 1, cName = head.indexOf('이름') + 1;
  if (!cCat || !cWhen) return '클럽 시트에 분류 또는 구입시기 칸이 없습니다.';

  var rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  var hit = [];
  for (var i = 0; i < rows.length; i++) {
    var c = String(rows[i][cCat - 1] || '').trim();
    if (cat !== 'all' && c !== cat) continue;
    sh.getRange(i + 2, cWhen).setValue(when);
    hit.push(String(rows[i][cName - 1] || ''));
  }
  var msg = hit.length ? (hit.length + '개에 "' + when + '" 를 적었습니다: ' + hit.join(', '))
                       : ('분류가 ' + cat + ' 인 클럽이 없습니다.');
  Logger.log(msg);
  return msg;
}

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
  migrate_();
  writeRow_(SH.round, {
    id: r.id, '날짜': r.date, '종류': r.type === 'field' ? '필드' : '스크린', '코스': r.course || '',
    '스코어': r.score == null ? '' : r.score, '파': r.par == null ? '' : r.par,
    '퍼팅': r.putts == null ? '' : r.putts, '페어웨이': r.fw == null ? '' : r.fw,
    '그린적중': r.gir == null ? '' : r.gir, 'OB': r.ob == null ? '' : r.ob,
    '벌타': r.penalty == null ? '' : r.penalty, '더블이상': r.dbl == null ? '' : r.dbl,
    '파이상': r.parOrBetter == null ? '' : r.parOrBetter,
    '홀별': listStr_(r.holes), '홀파': listStr_(r.pars),
    '메모': r.note || '', '분석': r.analysis || ''
  });
  return r.id;
}
function apiDeleteRound(id) { return delRow_(SH.round, id); }

/** [4,5,null,3] → "4,5,,3" — 한 칸에 홀별 타수를 담는다. */
function listStr_(a) {
  if (!a || !a.length) return '';
  return a.map(function (v) { return (v == null || v === '') ? '' : v; }).join(',');
}
/** "4,5,,3" → [4,5,null,3] */
function strList_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return null;
  var out = s.split(',').map(function (x) {
    x = String(x).trim();
    if (!x) return null;
    var n = Number(x);
    return isNaN(n) ? null : n;
  });
  var any = out.some(function (x) { return x != null; });
  return any ? out : null;
}

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
    if (/lite/.test(n)) v += 15;         /* 숫자 읽기에는 충분하고 더 빠르다 */
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
  var ok = props.getProperty('GEMINI_MODEL_OK_TXT') || props.getProperty('GEMINI_MODEL_OK');
  if (ok && !refresh) return ok;
  return models_(refresh)[0];
}

/**
 * 속도를 좌우하는 건 세 가지다.
 *  - 생각하는 시간: 요즘 모델은 답하기 전에 속으로 생각한다. 숫자 읽기에는 필요 없으니 끈다.
 *  - 뱉는 양: JSON 으로 못 박고 길이를 줄이면 생성이 짧게 끝난다.
 *  - 보내는 양: 사진을 작게 줄이는 건 화면 쪽에서 한다.
 */
/**
 * plain 이면 온도와 길이만 담아 보낸다.
 * 모델마다 받아주는 설정이 달라서, 거부당하면 맨몸으로 한 번 더 두드린다.
 */
function callModel_(name, parts, key, heavy, plain) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + name +
            ':generateContent?key=' + encodeURIComponent(key);
  var cfg = { temperature: heavy ? 0 : 0.3, maxOutputTokens: heavy ? 700 : 4096 };
  if (!plain) {
    if (heavy) {
      cfg.responseMimeType = 'application/json';
      /* 사진 판독은 숫자를 옮겨 적는 일이라 생각할 거리가 없다. 꺼서 시간을 번다.
         다만 이 설정을 못 받는 모델이 있어, 한 번 거부당하면 그 모델에는 다시 보내지 않는다. */
      var noThink = PropertiesService.getScriptProperties().getProperty('NOTHINK_' + name);
      if (!noThink) cfg.thinkingConfig = { thinkingBudget: 0 };
    }
    /* 글로 답하는 질문은 생각을 막지 않는다. 막으면 답이 그만큼 얕아진다. */
  }

  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: parts }],
      generationConfig: cfg
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
  var heavyNow = false;
  for (var hn = 0; hn < parts.length; hn++) if (parts[hn] && parts[hn].inline_data) heavyNow = true;
  var OKKEY = heavyNow ? 'GEMINI_MODEL_OK_IMG' : 'GEMINI_MODEL_OK_TXT';
  var first = props.getProperty(OKKEY) || props.getProperty('GEMINI_MODEL_OK');
  if (first) {
    var at = list.indexOf(first);
    if (at > 0) list.splice(at, 1);
    if (at !== 0) list.unshift(first);
  }

  /* 사진은 빠른 모델이, 글은 큰 모델이 낫다. 쓰임에 따라 순서를 달리한다. */
  var wantHeavy = false;
  for (var hp = 0; hp < parts.length; hp++) if (parts[hp] && parts[hp].inline_data) wantHeavy = true;
  function rank_(n) {
    var s = String(n).toLowerCase();
    if (wantHeavy) {                                  /* 사진 — 가벼운 것부터 */
      if (s.indexOf('lite') >= 0) return 0;
      if (s.indexOf('flash') >= 0) return 1;
      return 2;
    }
    if (s.indexOf('pro') >= 0) return 0;              /* 글 — 큰 것부터 */
    if (s.indexOf('flash') >= 0 && s.indexOf('lite') < 0) return 1;
    return 2;
  }
  list.sort(function (a, b) { return rank_(a) - rank_(b); });
  if (first) {                                        /* 전에 통했던 모델은 그래도 앞에 */
    var fa = list.indexOf(first);
    if (fa > 0) { list.splice(fa, 1); list.unshift(first); }
  }

  var busy = [];      /* 혼잡으로 비킨 모델 */
  var refused = [];   /* 요청을 거부한 모델 */
  var lastMsg = '';

  /* 사진이 붙은 호출은 한 번이 20~40초로 무겁다.
     같은 모델을 쉬었다 또 두드리면 시간만 쓰므로 그건 하지 않는다.
     다만 혼잡(503)은 그 모델만의 사정이라 **다른 모델로는 바로 넘어간다.**
     503 은 즉시 돌아오므로 세 모델을 거쳐도 대기는 거의 늘지 않는다. */
  var heavy = false;
  for (var pi = 0; pi < parts.length; pi++) if (parts[pi] && parts[pi].inline_data) heavy = true;
  var maxModels = heavy ? 3 : 4;
  var maxTries  = heavy ? 1 : 2;
  var napMs = heavy ? 0 : 1800;

  /* 최근 혼잡했던 모델은 잠시 건너뛴다. 매번 같은 벽에 부딪힐 이유가 없다. */
  var now = Date.now();
  var fresh = [];
  for (var bi = 0; bi < list.length; bi++) {
    var until = Number(props.getProperty('BUSY_' + list[bi]) || 0);
    if (until > now) continue;
    fresh.push(list[bi]);
  }
  if (fresh.length) list = fresh;

  for (var i = 0; i < list.length && i < maxModels; i++) {
    var name = list[i];
    var triedPlain = false;
    for (var tryNo = 0; tryNo < maxTries; tryNo++) {
      var res = callModel_(name, parts, key, heavy);
      var code = res.getResponseCode();
      var body = res.getContentText();

      if (code === 200) {
        var j = JSON.parse(body);
        var c = j.candidates && j.candidates[0];
        if (c && c.finishReason === 'SAFETY') throw new Error('이 사진은 처리하지 못했습니다. 다시 찍어 주세요.');
        var t = c && c.content && c.content.parts &&
                c.content.parts.map(function (p) { return p.text || ''; }).join('');
        if (t) {
          props.setProperty(OKKEY, name);
          return t.trim();
        }
        lastMsg = '답이 비어 있었습니다';
        break;                                  /* 다음 모델로 */
      }

      var msg = errMsg_(body);
      lastMsg = code + ' ' + msg;

      /* 거부(400)는 설정 탓일 때가 많다. 구글이 이유를 '잘못된 인자'라고만 할 때도 있어
         문구를 따지지 않고, 설정을 모두 뺀 맨몸으로 같은 모델에 한 번 더 보낸다. */
      if (code === 400 && !/API key|API_KEY/i.test(msg) && !triedPlain) {
        triedPlain = true;
        props.setProperty('NOTHINK_' + name, '1');
        res = callModel_(name, parts, key, heavy, true);
        code = res.getResponseCode();
        body = res.getContentText();
        if (code === 200) {
          var j2 = JSON.parse(body);
          var c2 = j2.candidates && j2.candidates[0];
          var t2 = c2 && c2.content && c2.content.parts &&
                   c2.content.parts.map(function (p) { return p.text || ''; }).join('');
          if (t2) { props.setProperty(OKKEY, name); return t2.trim(); }
        }
        msg = errMsg_(body);
        lastMsg = code + ' ' + msg;
      }

      /* 혼잡·일시 오류 */
      if (code === 429 || code === 500 || code === 503) {
        props.setProperty('BUSY_' + name, String(Date.now() + 5 * 60 * 1000));  /* 5분간 건너뛴다 */
        if (props.getProperty(OKKEY) === name) props.deleteProperty(OKKEY);
        busy.push(name);
        if (napMs && tryNo === 0 && maxTries > 1) { Utilities.sleep(napMs); continue; }
        break;                                   /* 바로 다음 모델로 */
      }
      /* 모델이 없어졌다 — 목록을 새로 받고 다음 모델 */
      if (code === 404) { models_(true); break; }
      /* 키 문제는 모델을 바꿔도 소용없다 */
      if (code === 403) throw new Error('키 권한 문제입니다. ' + (msg || '키를 다시 발급해 보세요.'));
      if (code === 400 && /API key|API_KEY/i.test(msg)) throw new Error('키가 올바르지 않습니다. 다시 넣어 주세요.');
      /* 한 모델이 거부했다고 끝이 아니다. 다음 모델이 받아주는 경우가 많다. */
      if (code === 400) { refused.push(name); break; }
      break;                                    /* 그 밖의 오류 — 다음 모델 */
    }
  }

  if (busy.length) {
    throw new Error('구글 모델 ' + busy.length + '개가 모두 혼잡합니다(' + busy.join(', ') + '). ' +
                    '지금은 구글 쪽 사정이라 기다리는 수밖에 없습니다. ' +
                    '1~2분 뒤 다시 누르시거나, 아래 칸에 직접 넣어 주세요.');
  }
  if (refused.length) {
    throw new Error('구글이 요청을 거부했습니다(' + refused.join(', ') + '). ' +
                    '마지막 응답: ' + lastMsg + ' — 편집기에서 clearBusy 를 실행한 뒤 다시 눌러 보세요.');
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
  props.deleteProperty('GEMINI_MODEL_OK_IMG');
  props.deleteProperty('GEMINI_MODEL_OK_TXT');
  props.deleteProperty('GEMINI_MODELS');
  var pick = models_(true)[0];
  /* 실제로 한 번 돌려 보되, 모델 혼잡으로 실패한 것까지 키 탓으로 돌리지 않는다.
     모델 목록을 받아낸 시점에서 키 자체는 이미 유효하다. */
  try {
    gemini_([{ text: '한 단어로만 답하세요: 골프' }]);
    return { ok: true, model: props.getProperty('GEMINI_MODEL_OK_TXT') || pick };
  } catch (e) {
    return { ok: true, model: pick, warn: e.message };
  }
}

/** 저장된 키를 지운다. */
function apiClearKey() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('GEMINI_KEY');
  props.deleteProperty('GEMINI_MODEL_OK');
  props.deleteProperty('GEMINI_MODEL_OK_IMG');
  props.deleteProperty('GEMINI_MODEL_OK_TXT');
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
  var t0 = Date.now();
  var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('사진을 읽을 수 없는 형식입니다.');
  var kb = Math.round(String(dataUrl).length * 0.75 / 1024);
  var prompt =
    '골프 연습장 스윙 측정기 결과 화면이다. 화면에 적힌 값만 읽어라. 없으면 null. 추정 금지.\n' +
    'club=클럽 이름. 화면 아래쪽에 "OOO 10회 클럽 측정한 결과입니다" 같은 작은 회색 문장이 있으면\n' +
    '  거기 적힌 이름을 그대로 쓴다(예 "3번 하이브리드","드라이버","7번 아이언"). 작아도 꼭 찾아 읽어라.\n' +
    '  그 문장이 없으면 화면에 적힌 표기 그대로(예 "7I","#7","DR","PW")\n' +
    'shots=친 발수, total=비거리 m, carry=캐리 m, apex=최고높이 m, ball=볼스피드 m/s,\n' +
    'launch=발사각 도, dir=방향각(L/R 붙여서 "L4.0"), side=사이드스핀(L/R 붙여서 "L282"),\n' +
    'back=백스핀 rpm, depth=앞뒤 편차 m, width=좌우 편차 m, landing=안착률 숫자, grade=등급 A~D\n' +
    '야드 표기면 미터로 바꾸고 unit="yd", 아니면 "m".\n' +
    'JSON 하나만 출력. 설명 금지.';
  var txt = gemini_([
    { text: prompt },
    { inline_data: { mime_type: m[1], data: m[2] } }
  ]);
  var out = pickJson_(txt);
  out._ms = Date.now() - t0;
  out._kb = kb;
  out._model = PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL_OK_IMG') || '';
  return out;
}

/**
 * 사진 판독이 느린지 빠른지 여기서 바로 재 본다. 폰도 네트워크도 끼지 않는다.
 * 편집기에서 실행하면 걸린 시간이 실행 기록에 찍힌다.
 */
function testPhotoSpeed() {
  /* 가로 8px 세로 8px 흰 사각형 — 내용은 중요하지 않고 왕복 시간만 본다 */
  var tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFUlEQVR42mP8/5+hng' +
             'EKGEeJwKhJAAAA//8DAFBLAwQUAAYACAAAACEA';
  var t0 = Date.now();
  var out;
  try {
    out = gemini_([{ text: '이 그림에 글자가 있으면 적고, 없으면 "없음" 한 단어로만 답하세요.' },
                    { inline_data: { mime_type: 'image/png', data: tiny.split(',')[1] } }]);
  } catch (e) {
    out = '실패: ' + e.message;
  }
  var ms = Date.now() - t0;
  var txt = '사진 한 장 왕복 ' + ms + 'ms (' + Math.round(ms / 1000) + '초)\n' +
            '쓴 모델: ' + (PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL_OK_IMG') || '-') + '\n' +
            '응답: ' + out;
  Logger.log(txt);
  return txt;
}

/**
 * 라운드 결과 화면이나 스코어카드에서 점수를 읽는다.
 * 스크린골프 결과 화면은 숫자가 또렷해 잘 읽히고, 손으로 쓴 종이는 덜 읽힌다.
 */
function apiReadRound(dataUrl) {
  var t0 = Date.now();
  var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('사진을 읽을 수 없는 형식입니다.');
  var kb = Math.round(String(dataUrl).length * 0.75 / 1024);
  var prompt =
    '골프 라운드 결과 화면 또는 스코어카드다. 적힌 값만 읽어라. 없으면 null. 추정 금지.\n' +
    'course=코스/골프장 이름, date=날짜 YYYY-MM-DD (두 자리 연도면 앞에 20을 붙인다)\n' +
    'kind="screen"(스크린골프) 또는 "field"\n' +
    'holes=Score 줄의 홀별 값을 1번 홀부터 순서대로 담은 배열(앞 9홀 다음에 뒤 9홀). 빈 칸은 null\n' +
    'pars=Par 줄의 홀별 값을 같은 순서로 담은 배열\n' +
    'putts=Putt 줄 전체 합계 (T 칸 두 개를 더한 값). 없으면 null\n' +
    'score=화면에 크게 적힌 총 타수, par=코스 총 파\n' +
    'relative=Score 줄이 실제 타수가 아니라 파 대비 값이면 true, 실제 타수면 false.\n' +
    '  판단법: Score 줄 합이 (총 타수 - 코스 파)와 같으면 true, 총 타수와 같으면 false.\n' +
    'fw=페어웨이 안착 홀 수, gir=그린 적중 홀 수, ob=OB 개수, penalty=벌타 개수\n' +
    '퍼센트로만 적혀 있으면 null. Score 줄은 본 그대로 적고 네가 바꾸지 마라.\n' +
    'JSON 하나만 출력. 설명 금지.';
  var txt = gemini_([
    { text: prompt },
    { inline_data: { mime_type: m[1], data: m[2] } }
  ]);
  var out = pickJson_(txt);
  out._ms = Date.now() - t0;
  out._kb = kb;
  out._model = PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL_OK_IMG') || '';
  return out;
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
