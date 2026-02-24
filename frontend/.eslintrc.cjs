module.exports = {
    env: { browser: true, es2021: true },
    extends: ["eslint:recommended", "plugin:vue/vue3-recommended", "plugin:@typescript-eslint/recommended", "prettier"],
    parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    parser: "vue-eslint-parser",
    plugins: ["vue", "@typescript-eslint"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  };
  