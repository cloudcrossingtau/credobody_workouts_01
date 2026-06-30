// デプロイ版の識別用。ビルド時のコミットハッシュを返す静的ファイル。
// クライアントが起動/前面復帰時に取得し、動作中の版と比較して自動更新の判定に使う。
export const prerender = true;

export function GET() {
  return new Response(
    JSON.stringify({ commit: import.meta.env.PUBLIC_BUILD_COMMIT }),
    { headers: { "content-type": "application/json" } },
  );
}
