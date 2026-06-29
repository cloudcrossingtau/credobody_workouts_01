#!/usr/bin/env bash
# mobile-web / admin の docker コンテナを停止する。

set -u
cd "$(dirname "$0")"

stop() {
  local name="$1"
  echo ""
  echo "=== $name ==="
  if (cd "$name" && docker compose down); then
    echo "$name: 停止完了"
  else
    echo "$name: 停止に失敗しました" >&2
    return 1
  fi
}

status=0
stop mobile-web || status=1
stop admin || status=1

echo ""
if [ $status -eq 0 ]; then
  echo "コンテナを停止しました"
else
  echo "コンテナの停止に失敗しました" >&2
fi
exit $status
