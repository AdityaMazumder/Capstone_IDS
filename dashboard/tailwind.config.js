/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5', // indigo-600
        safe: '#10B981',    // emerald-500
        low: '#0EA5E9',     // sky-500
        medium: '#FBBF24',  // amber-400
        high: '#F97316',    // orange-500
        critical: '#DC2626',// red-600
        offline: '#94A3B8', // slate-400
      },
    },
  },
  plugins: [],
}
