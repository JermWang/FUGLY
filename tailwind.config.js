module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: '#39ff14',
        boboBlue: '#77EBFF',
        boboBlueDark: '#00e0ff',
        boboPink: '#FF9393',
        pinkCard: '#ffd5ec',
        rose: '#FFA7A7',
      },
      fontFamily: {
        bobo: ['"Bagel Fat One"', 'cursive'],
        jersey: ['"Jersey 25"', 'sans-serif'],
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