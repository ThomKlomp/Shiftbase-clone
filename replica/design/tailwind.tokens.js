// Maps tokens.css custom properties into Tailwind. Components use bg-surface, text-muted, never raw hex.
const names = [
  'bg','surface','surface-sunken','border','border-input','text','text-muted','accent','accent-soft',
  'on-accent','danger','danger-soft','success','success-soft','warning','warning-soft','focus-ring',
  'avail-yes','avail-no',
  ...[1,2,3,4,5,6,7,8].flatMap(n => [`shift-${n}`, `shift-${n}-text`]),
];
module.exports = {
  theme: {
    extend: {
      colors: Object.fromEntries(names.map(n => [n, `var(--color-${n})`])),
      fontFamily: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', pill: 'var(--radius-pill)' },
      boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)' },
      transitionDuration: { fast: 'var(--motion-fast)', base: 'var(--motion-base)' },
      fontSize: {
        xs: ['12px', '16px'], sm: ['14px', '20px'], base: ['16px', '24px'],
        lg: ['20px', '28px'], xl: ['28px', '34px'], display: ['40px', '44px'],
      },
    },
  },
};
