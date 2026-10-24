import pluginReactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["public/build/**", "vendor/**", "node_modules/**"] },
  {
    extends: [
      ...tseslint.configs.recommended,
    ],
    files: ["resources/js/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { "allow": ["error", "warn"] }],
    },
  },
);
