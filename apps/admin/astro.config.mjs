// @ts-check
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// ビルド情報: version（package.json）＋ git のコミット情報。
// commit は Vercel SHA → git → "local"。time はコミット時刻（無ければ現在時刻）。
// admin/mobile とも同じコミットから起動すれば同じ値になる（動作版の一致確認用）。
const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
);
const git = (args) => {
  try {
    return execSync(`git -c safe.directory='*' ${args}`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
};
const version = pkg.version;
const commit =
  (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) ||
  git("rev-parse --short HEAD") ||
  "local";
const buildTime = git("show -s --format=%cI HEAD") || new Date().toISOString();

// https://astro.build/config
export default defineConfig({
  // 管理画面（デスクトップPC向け）。Vercel に静的デプロイ。
  integrations: [react()],

  devToolbar: { enabled: false },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    define: {
      "import.meta.env.PUBLIC_BUILD_VERSION": JSON.stringify(version),
      "import.meta.env.PUBLIC_BUILD_COMMIT": JSON.stringify(commit),
      "import.meta.env.PUBLIC_BUILD_TIME": JSON.stringify(buildTime),
    },
    server: {
      allowedHosts: [".trycloudflare.com"],
    },
  },
});
