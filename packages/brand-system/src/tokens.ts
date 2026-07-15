export const oneTimeTokens = {
  color: {
    background: '#050505',
    surface: '#0d1a20',
    surfaceRaised: '#071117',
    surfaceMuted: '#122229',
    text: '#ffffff',
    textWarm: '#f8faf7',
    textMuted: '#c8d6d9',
    textDisabled: '#a5aea9',
    action: '#ffd21f',
    actionAuthenticated: '#ede518',
    actionSoft: '#ffe680',
    accent: '#7ed7e8',
    accentAuthenticated: '#86e8ff',
    border: '#34464d',
    borderStrong: '#66777d',
    success: '#65d6a6',
    danger: '#ff7474',
    dangerText: '#8a331c',
  },
  typography: {
    display: "'DM Serif Display', Georgia, 'Times New Roman', serif",
    body: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '24px',
    6: '32px',
    7: '48px',
    8: '76px',
  },
  radius: {
    control: '8px',
    panel: '12px',
    pill: '999px',
  },
  componentSizes: {
    touchTarget: '44px',
    publicLogoMobile: '48px',
    publicLogoDesktop: '64px',
    appLogo: '40px',
  },
} as const;

export const brandAssetPaths = {
  logo: '/assets/brand/onetimelogo.webp',
  displayFont: '/assets/fonts/dm-serif-display-latin.woff2',
} as const;
