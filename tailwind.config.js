/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FBF7F1',
        'cream-dark': '#F1EADF',
        'cream-card': '#FFFDF9',
        terracotta: {
          DEFAULT: '#B5563A',
          dark: '#8E3F28',
        },
        sage: {
          DEFAULT: '#8FA88A',
          light: '#EDF1EA',
        },
        dark: '#23231F',
        muted: '#6B675E',
        'muted-light': '#8A857B',
        subtle: '#55524B',
        peach: '#F6DFD1',
        gold: '#D9A441',
        track: '#EAE2D5',
      },
      fontFamily: {
        sans: ["'Bricolage Grotesque'", 'system-ui', 'sans-serif'],
        serif: ["'Source Serif 4'", 'Georgia', 'serif'],
      },
      borderRadius: {
        pill: '999px',
        card: '16px',
      },
      maxWidth: {
        container: '1160px',
      },
      keyframes: {
        'bk-rise': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'bk-pulse': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'bk-rise': 'bk-rise 0.3s ease',
        'bk-pulse': 'bk-pulse 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
