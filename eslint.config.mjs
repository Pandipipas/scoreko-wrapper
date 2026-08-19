import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "dist/**",
      "release/**",
      "lib/**",
      "static/lib/**",
      "node_modules/**",
      ".corepack/**",
      ".electron-cache/**",
      ".localappdata/**",
      ".npm-cache/**",
      ".npm-runtime-cache/**",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
