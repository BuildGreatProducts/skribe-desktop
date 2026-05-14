import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--color-paper)',
        ink: 'var(--color-ink)',
        'ink-soft': 'var(--color-ink-soft)',
        'chrome-bg': 'var(--color-chrome-bg)',
        'chrome-text': 'var(--color-chrome-text)',
        'chrome-text-soft': 'var(--color-chrome-text-soft)',
        hairline: 'var(--color-hairline)',
        accent: 'var(--color-accent)',
        'accent-warm': 'var(--color-accent-warm)',
        selection: 'var(--color-selection)',
        highlight: 'var(--color-highlight)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
      },
      fontFamily: {
        editor: 'var(--font-editor)',
        ui: 'var(--font-ui)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        doc: 'var(--text-doc)',
        'doc-h6': 'var(--text-doc-h6)',
        'doc-h5': 'var(--text-doc-h5)',
        'doc-h4': 'var(--text-doc-h4)',
        'doc-h3': 'var(--text-doc-h3)',
        'doc-h2': 'var(--text-doc-h2)',
        'doc-h1': 'var(--text-doc-h1)',
        display: 'var(--text-display)',
      },
      spacing: {
        0.5: 'var(--space-0-5)',
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        13: 'var(--space-13)',
        16: 'var(--space-16)',
        20: 'var(--space-20)',
        24: 'var(--space-24)',
      },
      borderRadius: {
        none: '0',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        modal: 'var(--shadow-modal)',
      },
      lineHeight: {
        tight: 'var(--leading-tight)',
        normal: 'var(--leading-normal)',
        relaxed: 'var(--leading-relaxed)',
      },
    },
  },
  plugins: [],
};

export default config;
