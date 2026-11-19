/** @type {import('tailwindcss').Config} */

// Every colour resolves to a CSS custom property defined per theme in src/index.css
// (Hello Kitty-inspired light under [data-theme="light"], Kuromi-inspired dark under
// [data-theme="dark"]). Values are stored as "R G B" triplets so Tailwind opacity
// modifiers such as bg-accent/10 keep working in both themes.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        chrome: v('chrome'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        'surface-3': v('surface-3'),
        line: v('line'),
        'line-strong': v('line-strong'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        'ink-3': v('ink-3'),
        accent: v('accent'),
        'accent-hover': v('accent-hover'),
        'accent-ink': v('accent-ink'),
        'accent-soft': v('accent-soft'),
        'on-accent': v('on-accent'),
        brand: v('brand'),
        'brand-2': v('brand-2'),
        ok: v('ok'),
        'ok-ink': v('ok-ink'),
        'ok-soft': v('ok-soft'),
        warn: v('warn'),
        'warn-ink': v('warn-ink'),
        'warn-soft': v('warn-soft'),
        info: v('info'),
        'info-ink': v('info-ink'),
        'info-soft': v('info-soft'),
        danger: v('danger'),
        'danger-ink': v('danger-ink'),
        'danger-soft': v('danger-soft'),
        'on-danger': v('on-danger'),
      },
      fontFamily: {
        heading: ['"Nunito Sans"', '"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.4rem' }],
        md: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.6rem' }],
        xl: ['1.375rem', { lineHeight: '1.8rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.15rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.6rem' }],
      },
      borderRadius: {
        sheet: 'var(--r-sheet)',
        panel: 'var(--r-panel)',
        ctl: 'var(--r-ctl)',
      },
      boxShadow: {
        sheet: 'var(--shadow-sheet)',
        pop: 'var(--shadow-pop)',
        focus: '0 0 0 3px rgb(var(--focus) / 0.45)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.97) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-12deg)' },
          '75%': { transform: 'rotate(10deg)' },
        },
        blink: { '0%, 92%, 100%': { transform: 'scaleY(1)' }, '96%': { transform: 'scaleY(0.1)' } },
        dot: {
          '0%, 80%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '40%': { opacity: '1', transform: 'translateY(-3px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 260ms cubic-bezier(.2,.7,.2,1) both',
        'pop-in': 'pop-in 180ms cubic-bezier(.2,.7,.2,1) both',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(.2,.7,.2,1) both',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(.2,.7,.2,1) both',
        fade: 'fade 160ms ease-out both',
        wiggle: 'wiggle 500ms ease-in-out 1',
        blink: 'blink 5s infinite',
        dot: 'dot 1.1s infinite ease-in-out',
      },
    },
  },
  plugins: [],
}
