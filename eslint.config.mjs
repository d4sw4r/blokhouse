import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
    ...coreWebVitals,
    ...typescript,
    {
        rules: {
            // Bot-generated code uses any types; treat as warnings not errors
            "@typescript-eslint/no-explicit-any": "warn",
            // Allow unescaped quotes in JSX text
            "react/no-unescaped-entities": "warn",
            // Allow functions to be used before declaration (hoisting)
            "@typescript-eslint/no-use-before-define": "off",
        },
    },
];

export default eslintConfig;
