/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary: Navy dark backgrounds
        navy: {
          950: '#10182b',
          900: '#151f38',
          800: '#1c2a48',
          700: '#253458',
          600: '#2e3f6d',
        },
        // Primary: Orange brand accent
        brand: {
          600: '#e07f10',
          500: '#f7982c',
          400: '#fbba65',
          300: '#fcd49a',
        },
        // Slate kept for neutral text/surfaces
        slate: {
          950: '#020617',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
          200: '#e2e8f0',
        },
        // Violet kept as a secondary detail accent
        violet: {
          700: '#6d28d9',
          600: '#7c3aed',
          500: '#8b5cf6',
          400: '#a78bfa',
          300: '#c4b5fd',
        },
        indigo: {
          600: '#4f46e5',
          700: '#4338ca',
        },
        emerald: {
          500: '#10b981',
          400: '#34d399',
        },
        amber: {
          400: '#fbbf24',
        },
        rose: {
          500: '#f43f5e',
        },
      },
    },
  },
  plugins: [],
};
