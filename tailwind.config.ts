import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0F19',
        grape: '#A855F7',
        ice: '#22D3EE',
        coral: '#FB923C',
        mint: '#34D399',
        rose: '#F43F5E',
        mist: '#94A3B8',
      },
      fontFamily: {
        display: ['var(--font-body)', 'sans-serif'],
        sans: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-body)', 'monospace'],
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        pulseGlow: { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        scanLine: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
        pulseGlow: 'pulseGlow 2s ease-in-out infinite',
        slideUp: 'slideUp 0.4s ease-out',
        scanLine: 'scanLine 3s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
