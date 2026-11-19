/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // SYNCORA Hello Kitty-inspired palette
        primary: '#D95763',       // Cherry red
        'primary-dark': '#C04050',
        'primary-light': '#F4A6A6', // Soft coral
        secondary: '#FFF9EF',     // Vanilla cream
        background: '#FFF9EF',    // Vanilla cream base
        card: '#FFFFFF',
        accent: '#D95763',        // Cherry red
        'accent-dark': '#C04050',
        textPrimary: '#51413F',   // Cocoa brown
        textSecondary: '#8B7E7A',
        border: '#F0E6DA',
        success: '#B9D8C2',       // Mint green
        'success-dark': '#7BAF8E',
        warning: '#F5D982',       // Butter yellow
        'warning-dark': '#E0C255',
        error: '#D95763',         // Cherry red
        info: '#D8C9E8',          // Lavender
        'info-dark': '#B5A2D1',
        sidebar: '#FFF9EF',       // Vanilla cream
        'sidebar-active': '#D95763',
        mint: '#B9D8C2',
        lavender: '#D8C9E8',
        coral: '#F4A6A6',
        butter: '#F5D982',
        cocoa: '#51413F',
        cream: '#FFF9EF',
      },
      fontFamily: {
        heading: ['"Nunito Sans"', '"DM Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(81, 65, 63, 0.06)',
        'card-hover': '0 4px 20px rgba(217, 87, 99, 0.12)',
        sidebar: '2px 0 12px rgba(81, 65, 63, 0.06)',
        'soft': '0 1px 8px rgba(81, 65, 63, 0.04)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backgroundImage: {
        'dots-pattern': 'radial-gradient(circle, #F0E6DA 1px, transparent 1px)',
      },
      backgroundSize: {
        'dots': '20px 20px',
      },
    },
  },
  plugins: [],
}
