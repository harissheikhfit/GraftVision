export const sourceFilePattern = "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}";
export const structuredFilePattern = "*.{css,json,jsonc,yml,yaml}";
export const markdownFilePattern = "*.md";

export default {
  [sourceFilePattern]: [
    "eslint --fix --no-warn-ignored --max-warnings 0",
    "prettier --write --ignore-unknown",
  ],
  [structuredFilePattern]: "prettier --write --ignore-unknown",
  [markdownFilePattern]: "prettier --write --ignore-unknown",
};
