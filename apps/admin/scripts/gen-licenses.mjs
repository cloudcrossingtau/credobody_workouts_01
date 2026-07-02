#!/usr/bin/env node
/// ブラウザに配信される runtime 依存 OSS の一覧を public/licenses.json に書き出す。
/// 設定タブの「オープンソースライセンス」ページから fetch して表示する。
/// 依存追加時は `npm run gen:licenses` で再生成すること (build にも組込済)。
///
/// 「runtime」の判定:
///   1. package.json `dependencies` から下記のビルド専用パッケージを除外したものを「runtime root」とみなす
///   2. runtime root から node_modules を辿って transitive (dependencies / optionalDependencies)
///      を再帰収集する
///   3. 集まった集合に license-checker のメタデータを突き合わせて出力する
///
/// 業界 SaaS の「使用 OSS 一覧」と同程度の量に抑える目的。
/// (astro / vite / tailwindcss などのビルドツールは配信物に含まれないので不要)
import { init } from "license-checker-rseidelsohn";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");

const BUILD_TOOL_PATTERNS = [
  "astro",
  /^@astrojs\//,
  "vite",
  /^@vitejs\//,
  /^vite-/,
  "vitefu",
  "tailwindcss",
  /^@tailwindcss\//,
  "postcss",
  /^postcss-/,
  /^@postcss\//,
  "esbuild",
  /^@esbuild\//,
  /^esbuild-/,
  "rollup",
  /^@rollup\//,
  /^rollup-/,
  "terser",
  /^@terser\//,
  "lightningcss",
  /^lightningcss-/,
  "typescript",
  "tsx",
  /^@types\//,
];

function isBuildTool(name) {
  for (const p of BUILD_TOOL_PATTERNS) {
    if (typeof p === "string" ? name === p : p.test(name)) return true;
  }
  return false;
}

async function readPackageJson(name) {
  try {
    const path = resolve(appRoot, "node_modules", name, "package.json");
    return JSON.parse(await fs.readFile(path, "utf-8"));
  } catch {
    return null;
  }
}

async function collectRuntimePackages(roots) {
  const visited = new Set();
  async function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const pkg = await readPackageJson(name);
    if (!pkg) return;
    const next = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ];
    for (const dep of next) {
      if (isBuildTool(dep)) continue;
      await visit(dep);
    }
  }
  for (const r of roots) await visit(r);
  return visited;
}

function run() {
  return new Promise((resolveP, rejectP) => {
    init(
      {
        start: appRoot,
        production: true,
        excludePrivatePackages: true,
      },
      (err, packages) => {
        if (err) return rejectP(err);
        resolveP(packages);
      },
    );
  });
}

async function readMaybe(path) {
  if (!path) return null;
  try {
    const txt = await fs.readFile(path, "utf-8");
    return txt.length > 1_000_000 ? txt.slice(0, 1_000_000) : txt;
  } catch {
    return null;
  }
}

const rootPkg = JSON.parse(
  await fs.readFile(resolve(appRoot, "package.json"), "utf-8"),
);
const directDeps = Object.keys(rootPkg.dependencies ?? {});
const runtimeRoots = directDeps.filter((d) => !isBuildTool(d));
const runtime = await collectRuntimePackages(runtimeRoots);

const packages = await run();
const entries = await Promise.all(
  Object.entries(packages).map(async ([nameVersion, info]) => {
    const at = nameVersion.lastIndexOf("@");
    const name = nameVersion.slice(0, at);
    const version = nameVersion.slice(at + 1);
    return {
      name,
      version,
      licenses: info.licenses ?? "UNKNOWN",
      repository: info.repository ?? null,
      publisher: info.publisher ?? null,
      url: info.url ?? null,
      licenseText: await readMaybe(info.licenseFile),
    };
  }),
);

const filtered = entries
  .filter((e) => e.name !== rootPkg.name)
  .filter((e) => runtime.has(e.name))
  .sort((a, b) => a.name.localeCompare(b.name));

const out = resolve(appRoot, "public", "licenses.json");
await fs.mkdir(dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify(filtered, null, 2) + "\n");
console.log(`Wrote ${filtered.length} entries to ${out}`);
console.log(
  `  runtime roots (${runtimeRoots.length}): ${runtimeRoots.join(", ")}`,
);
