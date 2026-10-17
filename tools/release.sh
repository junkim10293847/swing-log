#!/usr/bin/env bash
# 버전을 찍고 올린다.  사용법:  tools/release.sh "무엇을 바꿨는지 한 줄"
#
#   1) 지난 버전 다음 번호를 매긴다  (v9 → v10)
#   2) docs/index.html 안에 그 번호를 심는다
#   3) docs/version.json 에 변경 내역을 한 줄 쌓는다
#   4) 커밋하고 민다
#
# 앱은 version.json 을 열 때와 다시 볼 때 읽어, 자기 번호와 다르면 "새 버전" 띠를 띄운다.
set -euo pipefail
cd "$(dirname "$0")/.."

NOTE="${1:-}"
if [ -z "$NOTE" ]; then
  echo '무엇을 바꿨는지 한 줄 적어 주세요:  tools/release.sh "..."' >&2
  exit 1
fi

node -e "new Function(require('fs').readFileSync('server/Code.gs','utf8'))"
VER=$(python3 tools/bump.py "$NOTE")

git add -A
git commit -q -m "$VER — $NOTE

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014STSow1pyRFAemnNMib9uM"
git push -q origin HEAD:main
echo "올렸습니다: $VER"
