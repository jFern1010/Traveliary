// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Deno Edge Function entry points use npm: imports that Node tooling cannot resolve.
    ignores: ["dist/*", "supabase/functions/**/index.ts"],
  }
]);
