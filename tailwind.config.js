module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream:  '#F5EDD6',
        sand:   '#EDE0BC',
        fblue:  '#3B82F6',
        fpurple:'#8B5CF6',
        fteal:  '#06B6D4',
        fpink:  '#F472B6',
        fyellow:'#FACC15',
        fdark:  '#1E1040',
      },
      fontFamily: {
        display: ['"Fredoka"', 'sans-serif'],
        body:    ['"Nunito"',  'sans-serif'],
        bobo:    ['"Fredoka"', 'sans-serif'],
        jersey:  ['"Fredoka"', 'sans-serif'],
        mono:    ['"Nunito"',  'sans-serif'],
      },
      borderWidth: {
        '6': '6px',
        '8': '8px',
      },
      boxShadow: {
        'retro': '6px 6px 0px 0px rgba(0, 0, 0, 1)',
        'retro-lg': '10px 10px 0px 0px rgba(0, 0, 0, 1)',
        'glow': '0 0 15px rgba(255, 167, 167, 0.4)',
        'glow-lg': '0 0 30px rgba(255, 167, 167, 0.6)',
      }
    },
  },
  plugins: [],
}