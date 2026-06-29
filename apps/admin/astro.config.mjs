// @ts-check
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// ビルド情報: package.json の version + Vercel が注入する commit SHA。
const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
);
const version = pkg.version;
const commit = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "local";
const buildTime = new Date().toISOString();

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
