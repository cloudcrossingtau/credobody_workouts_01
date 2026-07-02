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

// 設定 > オープンソースライセンスのページ本体。
// /licenses.json は build 時（npm run gen:licenses）に生成される。
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

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <a href="/settings" className="rounded-lg p-2 text-muted hover:bg-gray-100">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </a>
        <h2 className="flex-1 text-[20px] font-semibold text-foreground">
          オープンソースライセンス
        </h2>
      </div>

      {error && <p className="text-[15px] text-red-700">{error}</p>}

      {entries === null && !error && (
        <p className="py-10 text-center text-[15px] text-muted">読み込み中…</p>
      )}

      {entries !== null && (
        <>
          <p className="mb-6 text-[14px] text-muted">
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
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
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
        </>
      )}
    </div>
  );
}
