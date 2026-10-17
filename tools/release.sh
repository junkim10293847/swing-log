#!/usr/bin/env bash
# 버전을 찍고 올린다.  사용법:  tools/release.sh "무엇을 바꿨는지 한 줄"
#
# 버전은  날짜 + 그날의 몇 번째  꼴이다.   예)  2026-10-17 v3
#
# 하는 일
#   1) 오늘 날짜로 그날의 몇 번째인지 세어 버전을 만든다
#   2) docs/index.html 의 app-version 메타를 그 값으로 바꾼다
#   3) docs/version.json 에 현재 버전과 변경 내역을 쌓는다
#   4) 커밋하고 민다
#
# 앱은 version.json 을 열 때와 다시 들여다볼 때 읽어, 자기 버전과 다르면 띠를 띄운다.
set -euo pipefail
cd "$(dirname "$0")/.."

NOTE="${1:-}"
if [ -z "$NOTE" ]; then echo "무엇을 바꿨는지 한 줄 적어 주세요: tools/release.sh \"...\"" >&2; exit 1; fi

VER=$(python3 - "$NOTE" <<'PY'
import json,sys,os,io,re,datetime
note=sys.argv[1]
day=datetime.date.today().isoformat()
p='docs/version.json'
d={'v':'','built':'','log':[]}
if os.path.exists(p):
    try: d['log']=json.load(open(p)).get('log',[])
    except Exception: pass
n=sum(1 for e in d['log'] if str(e.get('v','')).startswith(day))+1
ver='%s v%d'%(day,n)

d['v']=ver
d['built']=datetime.datetime.now().astimezone().isoformat(timespec='seconds')
d['log'].insert(0,{'v':ver,'date':day,'note':note})
d['log']=d['log'][:40]
io.open(p,'w',encoding='utf-8').write(json.dumps(d,ensure_ascii=False,indent=1))

h='docs/index.html'; s=io.open(h,encoding='utf-8').read()
tag='<meta name="app-version" content="%s">'%ver
if re.search(r'<meta name="app-version"[^>]*>', s):
    s=re.sub(r'<meta name="app-version"[^>]*>', tag, s, count=1)
else:
    s=s.replace('<meta charset="utf-8">','<meta charset="utf-8">\n'+tag,1)
io.open(h,'w',encoding='utf-8').write(s)

js=re.findall(r'<script>([\s\S]*?)</script>', s)
io.open('/tmp/_relcheck.js','w',encoding='utf-8').write("\n".join(js))
print(ver)
PY
)

node --check /tmp/_relcheck.js
node -e "new Function(require('fs').readFileSync('server/Code.gs','utf8'))"
cp docs/index.html /mnt/user-data/outputs/swing-log-web/docs/index.html 2>/dev/null || true
cp server/Code.gs  /mnt/user-data/outputs/swing-log-web/server/Code.gs  2>/dev/null || true

git add -A
git commit -q -m "$VER — $NOTE

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014STSow1pyRFAemnNMib9uM"
git push -q origin HEAD:main
echo "올렸습니다: $VER"
