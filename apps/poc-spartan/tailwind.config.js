const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        govbr: {
          // Cores institucionais Gov.br (blue-warm-vivid)
          'primary': 'var(--blue-warm-vivid-70, #1351b4)',
          'primary-hover': 'var(--blue-warm-vivid-60, #155bcb)',
          'primary-dark': 'var(--blue-warm-vivid-80, #0c326f)',
          'primary-darkest': 'var(--blue-warm-vivid-90, #071d41)',
          'primary-light': 'var(--blue-warm-vivid-50, #2670e8)',
          'primary-lightest': 'var(--blue-warm-vivid-5, #edf5ff)',

          // Feedback
          'success': 'var(--green-cool-vivid-50, #168821)',
          'success-light': 'var(--green-cool-vivid-5, #e7f4e9)',
          'warning': 'var(--yellow-vivid-20, #ffcd07)',
          'warning-light': 'var(--yellow-vivid-5, #fef0c8)',
          'danger': 'var(--red-vivid-50, #e52207)',
          'danger-light': 'var(--red-vivid-5, #fcf0ee)',
          'info': 'var(--blue-warm-vivid-70, #1351b4)',
          'info-light': 'var(--blue-warm-vivid-5, #edf5ff)',

          // Neutros
          'pure-0': 'var(--pure-0, #ffffff)',
          'pure-100': 'var(--pure-100, #000000)',
          'gray-2': 'var(--gray-2, #f8f8f8)',
          'gray-5': 'var(--gray-5, #ededed)',
          'gray-10': 'var(--gray-10, #e6e6e6)',
          'gray-20': 'var(--gray-20, #cccccc)',
          'gray-40': 'var(--gray-40, #888888)',
          'gray-60': 'var(--gray-60, #636363)',
          'gray-80': 'var(--gray-80, #333333)',
        },
      },
      fontFamily: {
        govbr: ['Rawline', 'Raleway', 'sans-serif'],
      },
      fontSize: {
        'govbr-xs': ['11.2px', { lineHeight: '1.45' }],
        'govbr-sm': ['12.8px', { lineHeight: '1.45' }],
        'govbr-base': ['14px', { lineHeight: '1.45' }],
        'govbr-md': ['16px', { lineHeight: '1.45' }],
        'govbr-lg': ['20px', { lineHeight: '1.35' }],
        'govbr-xl': ['24px', { lineHeight: '1.35' }],
        'govbr-2xl': ['32px', { lineHeight: '1.25' }],
        'govbr-3xl': ['40px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        'govbr-sm': '4px',
        'govbr': '8px',
        'govbr-pill': '100px',
      },
      spacing: {
        'govbr-1': '4px',
        'govbr-2': '8px',
        'govbr-3': '12px',
        'govbr-4': '16px',
        'govbr-5': '24px',
        'govbr-6': '32px',
        'govbr-7': '40px',
        'govbr-8': '48px',
        'govbr-9': '64px',
      },
    },
  },
  plugins: [],
};
