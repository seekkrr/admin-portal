import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactRefreshPlugin from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            "react-hooks": reactHooksPlugin,
            "react-refresh": reactRefreshPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...tsPlugin.configs.strict.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/consistent-type-imports": [
                "error",
                { prefer: "type-imports" },
            ],
            "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true },
            ],
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "prefer-const": "error",
            "no-var": "error",
            eqeqeq: ["error", "always"],
        },
    },
    {
        ignores: ["dist/**", "node_modules/**", "*.config.js", "*.config.ts"],
    },
];
