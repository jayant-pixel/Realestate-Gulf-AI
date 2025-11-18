import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: [
      '**/node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'Icecream-Kiosk-AI-Avatar/**',
      'supabase/**',
      'agents/**',
      'docs/**',
      'IMPLEMENTATION_PLAN.md',
      'audit.md'
    ],
  },
  ...nextCoreWebVitals,
];

export default config;
