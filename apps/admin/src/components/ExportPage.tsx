import { useState } from "react";
import { pullAllUserGrids } from "@/lib/devData";
import { recordsToCsv, downloadCsv } from "@/lib/exportCsv";
import { withRetry } from "@/lib/recover";

// 開発者専用: 全ユーザーのトレーニング記録を縦持ち CSV でダウンロードする。
export function ExportPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onExport() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const users = await withRetry(() => pullAllUserGrids(), {
        timeoutMs: 15000,
        maxAttempts: 2,
        label: "pullAllUserGrids",
      });
      const total = users.reduce(
        (s, u) => s + Object.keys(u.minutes).length,
        0,
      );
      if (total === 0) {
        setMsg("エクスポートできる記録がありません。");
        return;
      }
      const csv = recordsToCsv(users);
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      const fname = `credobody_records_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.csv`;
      downloadCsv(fname, csv);
      setMsg(`${users.length} 名 / ${total} 件を書き出しました。`);
    } catch (e) {
      console.warn("[export] failed:", e);
      setErr(
        "エクスポートに失敗しました：" +
          (e instanceof Error ? e.message : "不明なエラー"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-[20px] font-semibold text-foreground">
        エクスポート
      </h2>
      <p className="mb-5 text-[13px] text-muted">
        全ユーザーのトレーニング記録を CSV でダウンロードします（開発者のみ）。
      </p>

      <section className="rounded-2xl border border-card-border bg-card-bg p-5">
        <h3 className="text-[16px] font-semibold text-slate-900">
          記録 CSV（縦持ち）
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          列：メール / ニックネーム / 日付 / 項目 / 単位 / 値。Excel
          で開ける UTF-8（BOM付き）。
        </p>
        <button
          onClick={onExport}
          disabled={busy}
          className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
        >
          {busy ? "書き出し中…" : "CSVをダウンロード"}
        </button>
        {msg && <p className="mt-3 text-[14px] text-emerald-700">{msg}</p>}
        {err && <p className="mt-3 text-[14px] text-red-600">{err}</p>}
      </section>
    </div>
  );
}
