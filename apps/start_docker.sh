#!/usr/bin/env bash
# mobile-web / admin の docker コンテナを起動する。

set -u
cd "$(dirname "$0")"

start() {
  local name="$1"
  echo ""
  echo "=== $name ==="
  if (cd "$name" && docker compose up -d); then
    echo "$name: 起動完了"
  else
    echo "$name: 起動に失敗しました" >&2
    return 1
  fi
}

status=0
start mobile-web || status=1
start admin || status=1

echo ""
if [ $status -eq 0 ]; then
  echo "コンテナが起動しました"
  echo "  mobile-web: http://localhost:4323 （実機は http://<PCのIP>:4323）"
  echo "  admin:      http://localhost:4324 （デスクトップ管理画面）"
else
  echo "コンテナの起動に失敗しました" >&2
fi
exit $status
