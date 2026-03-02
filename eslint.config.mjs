import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// Override react-compiler rule severity: find the config block that owns the plugin
const withCompilerOverride = coreWebVitals.map((cfg) => {
    if (cfg.plugins?.["react-compiler"]) {
        return {
            ...cfg,
            rules: {
                ...cfg.rules,
                "react-compiler/react-compiler": "warn",
            },
        };
    }
    return cfg;
});

const eslintConfig = [
    ...withCompilerOverride,
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
