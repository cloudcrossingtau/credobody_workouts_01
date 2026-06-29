import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  pullRemote,
  saveItems,
  deleteAllRecords,
  replaceAllRecords,
  uuid,
} from "@/lib/sync";
import { type Item, SEED_ITEMS, seedMinutes } from "@/lib/training";

// 開発用のデモ投入・全削除。本番ビルドではページごと出力されない（data.astro 側で DEV ガード）。
export function DataPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      try {
        const remote = await pullRemote();
        if (remote) setItems(remote.items);
      } catch (e) {
        console.warn("[load] failed:", e);
      }
    })();
  }, []);

  async function loadDemo() {
    const noItems = items.length === 0;
    const m = noItems
      ? "デモ用の項目（ラン/バイク/脚/腕/腹筋/背筋）と過去6週間の記録を投入します。よろしいですか？"
      : "既存の記録を置き換えて、デモ用データ（過去6週間）を投入します。よろしいですか？";
    if (!confirm(m)) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      let list = items;
      if (noItems) {
        list = SEED_ITEMS.map((it) => ({ ...it, id: uuid() }));
        if (supabase) await saveItems(list);
        setItems(list);
      }
      const demo = seedMinutes(list);
      if (supabase) await replaceAllRecords(demo);
      setMsg("デモ用データを投入しました。");
    } catch (e) {
      console.warn("[demo] failed:", e);
      setError("デモ用データの投入に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!confirm("すべての記録を削除します。よろしいですか？")) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      if (supabase) await deleteAllRecords();
      setMsg("全記録を削除しました。");
    } catch (e) {
      console.warn("[clear] failed:", e);
      setError("記録の削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="mb-5 flex items-center gap-2">
        <a
          href="/settings"
          className="rounded-lg px-2 py-1 text-[15px] text-accent hover:bg-slate-100"
        >
          ‹ 設定
        </a>
        <h2 className="text-[20px] font-semibold text-foreground">
          データ（開発用）
        </h2>
      </div>

      <div className="flex gap-2">
        <button
          onClick={loadDemo}
          disabled={busy}
          className="flex-1 rounded-xl border border-slate-300 bg-card-bg px-4 py-2.5 text-[15px] font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          デモ用データを投入
        </button>
        <button
          onClick={clearAll}
          disabled={busy}
          className="flex-1 rounded-xl border border-red-300 bg-card-bg px-4 py-2.5 text-[15px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          全記録を削除
        </button>
      </div>
      {msg && <p className="mt-3 text-[14px] text-emerald-700">{msg}</p>}
      {error && <p className="mt-3 text-[14px] font-medium text-red-600">{error}</p>}
    </div>
  );
}
