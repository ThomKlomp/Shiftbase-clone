const tokens = require('./replica/design/tailwind.tokens.js');
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  ...tokens,
  theme: { ...tokens.theme, extend: { ...tokens.theme.extend } },
  plugins: [],
};
