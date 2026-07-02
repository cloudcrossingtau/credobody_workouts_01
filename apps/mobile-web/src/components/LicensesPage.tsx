import { useEffect, useState } from "react";

interface LicenseEntry {
  name: string;
  version: string;
  licenses: string;
  repository: string | null;
  publisher: string | null;
  url: string | null;
  licenseText: string | null;
}

// オープンソースライセンス一覧の本体。/licenses.json は build 時に生成される。
// ページ側（licenses.astro）が戻るヘッダを持つので、ここは一覧のみ。
export function LicensesPage() {
  const [entries, setEntries] = useState<LicenseEntry[] | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/licenses.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<LicenseEntry[]>;
      })
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((e) => {
        console.error("[LicensesPage] load failed:", e);
        if (!cancelled) setError("ライセンス情報の読み込みに失敗しました。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (error) return <p className="pt-6 text-[15px] text-red-700">{error}</p>;
  if (entries === null)
    return <p className="pt-6 text-center text-[15px] text-muted">読み込み中…</p>;

  return (
    <div className="pb-8">
      <p className="mb-4 text-[14px] text-muted">
        本アプリは以下の {entries.length}{" "}
        件のオープンソースソフトウェアを使用しています。各ライブラリは元のライセンスに従って利用しています。
      </p>
      <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
        {entries.map((e) => {
          const key = `${e.name}@${e.version}`;
          const isOpen = expanded.has(key);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggle(key)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-foreground">
                    {e.name}
                  </p>
                  <p className="text-[12px] text-muted">
                    v{e.version} ・ {e.licenses}
                  </p>
                </div>
                <span
                  className={`text-[18px] leading-none text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  ⌃
                </span>
              </button>
              {isOpen && (
                <div className="space-y-2 bg-gray-50 px-4 pb-4">
                  {e.publisher && (
                    <p className="text-[13px] text-muted">著者: {e.publisher}</p>
                  )}
                  {e.repository && (
                    <p className="text-[13px]">
                      <a
                        href={e.repository}
                        target="_blank"
                        rel="noreferrer"
                        className="wrap-break-word text-accent underline"
                      >
                        {e.repository}
                      </a>
                    </p>
                  )}
                  {e.licenseText ? (
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border border-card-border bg-white p-3 font-mono text-[12px] leading-relaxed text-foreground">
                      {e.licenseText}
                    </pre>
                  ) : (
                    <p className="text-[12px] text-muted">
                      ライセンス本文はリポジトリを参照してください。
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
