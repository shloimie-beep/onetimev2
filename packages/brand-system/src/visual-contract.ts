import { routeBranding, type RouteVisualState } from './route-branding.ts';

export type VisualViewport = {
  id: string;
  width: number;
  height: number;
  notes: string;
};

export type VisualMode =
  | 'default'
  | 'zoom-200'
  | 'rtl'
  | 'reduced-motion'
  | 'keyboard-focus'
  | 'long-content'
  | 'slow-state'
  | 'error-state';

export type ComponentContract = {
  id: string;
  primitive: string;
  variants: readonly string[];
  states: readonly RouteVisualState[];
  fixtureSelector: string;
};

export const visualViewports: readonly VisualViewport[] = [
  { id: '360x800', width: 360, height: 800, notes: 'Small mobile top-fold contract.' },
  { id: '390x844', width: 390, height: 844, notes: 'Primary iPhone-sized mobile contract.' },
  { id: '768x1024', width: 768, height: 1024, notes: 'Tablet portrait contract.' },
  { id: '1440x1000', width: 1440, height: 1000, notes: 'Desktop workspace contract.' },
];

export const visualModes: readonly VisualMode[] = [
  'default',
  'zoom-200',
  'rtl',
  'reduced-motion',
  'keyboard-focus',
  'long-content',
  'slow-state',
  'error-state',
];

export const preUsableScreenshotBan = [
  'Refreshing',
  'Checking session',
  'Signed out',
  'Skeleton only',
  'placeholder helper not connected',
] as const;

export const visualBudgets = {
  lcpMs: 2500,
  cls: 0.1,
  horizontalOverflow: false,
  minTouchTargetCssPx: 44,
  maxPublicJsRawBytes: 45_000,
  maxPublicCssRawBytes: 35_000,
} as const;

export const componentContracts: readonly ComponentContract[] = [
  {
    id: 'shell-header',
    primitive: 'Header',
    variants: ['public', 'owner-admin', 'parent', 'student', 'support'],
    states: ['ready', 'session-expired', 'denied'],
    fixtureSelector: '[data-fixture="shell-header"]',
  },
  {
    id: 'section-tabs',
    primitive: 'SectionTabs',
    variants: ['scrolling', 'current', 'disabled'],
    states: ['ready', 'slow'],
    fixtureSelector: '[data-ot-primitive="SectionTabs"]',
  },
  {
    id: 'cards',
    primitive: 'Card',
    variants: ['default', 'metric', 'mobile', 'readonly'],
    states: ['ready', 'empty', 'error'],
    fixtureSelector: '[data-fixture="cards"]',
  },
  {
    id: 'metric-tiles',
    primitive: 'MetricTile',
    variants: ['compact', 'default', 'trend'],
    states: ['ready', 'loading', 'empty'],
    fixtureSelector: '[data-ot-primitive="MetricTile"]',
  },
  {
    id: 'tables-mobile-cards',
    primitive: 'Table',
    variants: ['desktop-table', 'mobile-card-stack'],
    states: ['ready', 'loading', 'empty', 'error'],
    fixtureSelector: '[data-fixture="table-mobile"]',
  },
  {
    id: 'filter-scroller',
    primitive: 'FilterStrip',
    variants: ['horizontal', 'selected', 'long-label'],
    states: ['ready', 'loading'],
    fixtureSelector: '[data-ot-primitive="FilterStrip"]',
  },
  {
    id: 'forms',
    primitive: 'Input',
    variants: ['text', 'select', 'checkbox', 'textarea', 'validation'],
    states: ['ready', 'error', 'denied'],
    fixtureSelector: '[data-fixture="forms"]',
  },
  {
    id: 'cta-buttons',
    primitive: 'Button',
    variants: ['primary', 'secondary', 'text', 'danger', 'disabled'],
    states: ['ready', 'loading', 'denied'],
    fixtureSelector: '[data-fixture="buttons"]',
  },
  {
    id: 'status-chips',
    primitive: 'StatusChip',
    variants: ['neutral', 'success', 'warning', 'danger', 'info'],
    states: ['ready', 'error', 'denied'],
    fixtureSelector: '[data-ot-primitive="StatusChip"]',
  },
  {
    id: 'states',
    primitive: 'StatePanel',
    variants: ['empty', 'loading', 'error', 'denied', 'offline', 'session-expired'],
    states: ['empty', 'loading', 'error', 'denied', 'offline', 'session-expired'],
    fixtureSelector: '[data-fixture="states"]',
  },
  {
    id: 'drawers-dialogs',
    primitive: 'Dialog',
    variants: ['drawer', 'dialog', 'confirmation'],
    states: ['ready', 'denied', 'error'],
    fixtureSelector: '[data-fixture="drawers-dialogs"]',
  },
  {
    id: 'toast-banner',
    primitive: 'ToastBanner',
    variants: ['info', 'success', 'warning', 'error'],
    states: ['ready', 'error'],
    fixtureSelector: '[data-ot-primitive="ToastBanner"]',
  },
  {
    id: 'footer',
    primitive: 'Footer',
    variants: ['public', 'authenticated'],
    states: ['ready'],
    fixtureSelector: '[data-ot-primitive="Footer"]',
  },
  {
    id: 'media-frame',
    primitive: 'MediaFrame',
    variants: ['image', 'placeholder-free', 'caption'],
    states: ['ready', 'loading', 'error'],
    fixtureSelector: '[data-ot-primitive="MediaFrame"]',
  },
  {
    id: 'activity-timeline',
    primitive: 'ActivityTimeline',
    variants: ['short', 'long-content'],
    states: ['ready', 'empty'],
    fixtureSelector: '[data-ot-primitive="ActivityTimeline"]',
  },
];

export function visualMatrixRows() {
  return routeBranding.flatMap((route) =>
    visualViewports.flatMap((viewport) =>
      visualModes.map((mode) => ({
        route: route.route,
        shell: route.shell,
        role: route.role,
        bundle: route.bundle,
        viewport: viewport.id,
        mode,
        states: route.states,
        evidenceSelector: route.evidenceSelector,
        capturePolicy: 'wait for final usable selector or intentionally named state fixture',
      })),
    ),
  );
}
