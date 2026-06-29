import { useState } from "react";

// アバター円。画像が無い/読み込み失敗時は頭文字を表示する。
export function Avatar({
  url,
  fallback,
  size = 36,
}: {
  url: string | null;
  fallback: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = url && !failed;
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-light"
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="font-bold text-accent"
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {fallback}
        </span>
      )}
    </div>
  );
}
