// Service Worker (最小構成)
// 役割: PWA インストール可能性を満たすための fetch ハンドラ存在のみ。
// オフライン対応やキャッシュ戦略は機能要件が固まってから追加する。

const CACHE_VERSION = "v1";

self.addEventListener("install", (_event) => {
  // 即時アクティベートして古い SW を置き換える
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 即時クライアント取得 (タブを閉じなくても新 SW が効く)
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // 現状はネットワーク直行 (キャッシュ戦略は今後追加)。
  // ここに fetch ハンドラがあること自体がインストール条件を満たす。
  event.respondWith(fetch(event.request));
});
