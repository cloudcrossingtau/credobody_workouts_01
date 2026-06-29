/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_DISABLE_SIGNUP: string;
  readonly PUBLIC_BUILD_VERSION: string;
  readonly PUBLIC_BUILD_COMMIT: string;
  readonly PUBLIC_BUILD_TIME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
