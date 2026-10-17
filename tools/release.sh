#!/usr/bin/env bash
# 버전을 찍고 올린다.  사용법:  tools/release.sh "무엇을 바꿨는지 한 줄"
#
# 하는 일
#   1) 오늘 날짜 + 그날의 몇 번째인지로 버전을 만든다  (예 2026.10.17.3)
#   2) docs/index.html 의 app-version 메타를 그 값으로 바꾼다
#   3) docs/version.json 에 현재 버전과 변경 내역을 쌓는다
#   4) 커밋하고 민다
#
# 앱은 version.json 을 주기적으로 읽어 자기 버전과 다르면 "새 버전" 띠를 띄운다.
set -euo pipefail
cd "$(dirname "$0")/.."

NOTE="${1:-}"
if [ -z "$NOTE" ]; then echo "무엇을 바꿨는지 한 줄 적어 주세요: tools/release.sh \"...\"" >&2; exit 1; fi

DAY=$(date +%Y.%m.%d)
N=$(python3 - "$DAY" <<'PY'
import json,sys,os
day=sys.argv[1]; p='docs/version.json'
log=[]
if os.path.exists(p):
    try: log=json.load(open(p)).get('log',[])
    except Exception: log=[]
print(sum(1 for e in log if str(e.get('v','')).startswith(day))+1)
PY
)
VER="$DAY.$N"

python3 - "$VER" "$NOTE" <<'PY'
import json,sys,os,io,re,datetime
ver,note=sys.argv[1],sys.argv[2]
p='docs/version.json'
d={'v':ver,'built':datetime.datetime.now().astimezone().isoformat(timespec='seconds'),'log':[]}
if os.path.exists(p):
    try: d['log']=json.load(open(p)).get('log',[])
    except Exception: pass
d['log'].insert(0,{'v':ver,'date':datetime.date.today().isoformat(),'note':note})
d['log']=d['log'][:40]
io.open(p,'w',encoding='utf-8').write(json.dumps(d,ensure_ascii=False,indent=1))

h='docs/index.html'; s=io.open(h,encoding='utf-8').read()
tag='<meta name="app-version" content="%s">'%ver
if re.search(r'<meta name="app-version"[^>]*>', s):
    s=re.sub(r'<meta name="app-version"[^>]*>', tag, s, count=1)
else:
    s=s.replace('<meta charset="utf-8">','<meta charset="utf-8">\n'+tag,1)
io.open(h,'w',encoding='utf-8').write(s)
print(ver)
PY

node -e "new Function(require('fs').readFileSync('server/Code.gs','utf8'))" 2>/dev/null || true
git add -A
git commit -q -m "$VER — $NOTE

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014STSow1pyRFAemnNMib9uM"
git push -q origin HEAD:main
echo "올렸습니다: $VER"
