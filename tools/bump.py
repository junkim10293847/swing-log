# 버전 번호를 하나 올리고 앱과 version.json 에 심는다. release.sh 가 부른다.
import json, sys, os, io, re, datetime

note = sys.argv[1]
p = 'docs/version.json'
d = {'v': '', 'built': '', 'log': []}
if os.path.exists(p):
    try:
        d = json.load(open(p))
    except Exception:
        pass

log = d.get('log', [])
nums = [int(re.sub(r'[^0-9]', '', str(e.get('v', '0'))) or 0) for e in log]
ver = 'v%d' % ((max(nums) if nums else 0) + 1)

d['v'] = ver
d['built'] = datetime.datetime.now().astimezone().isoformat(timespec='seconds')
log.insert(0, {'v': ver, 'date': datetime.date.today().isoformat(), 'note': note})
d['log'] = log[:60]
io.open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))

h = 'docs/index.html'
s = io.open(h, encoding='utf-8').read()
tag = '<meta name="app-version" content="%s">' % ver
if re.search(r'<meta name="app-version"[^>]*>', s):
    s = re.sub(r'<meta name="app-version"[^>]*>', tag, s, count=1)
else:
    s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + tag, 1)
io.open(h, 'w', encoding='utf-8').write(s)
print(ver)
