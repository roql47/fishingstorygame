/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        fishinggame: {
          "primary": "#10b981",
          "secondary": "#38bdf8",
          "accent": "#f59e0b",
          "neutral": "#1f2937",
          "base-100": "#0c4a6e",
        }
      },
      "dark"
    ]
  }
}


