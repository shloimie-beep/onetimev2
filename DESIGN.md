---
version: alpha
name: One Time
description: Standalone black, yellow, white, and ice-blue learning experience for Parents, Students, and Rabbi-led operations.
colors:
  primary: '#ffd21f'
  ink: '#050505'
  surface: '#0d1a20'
  surface-raised: '#071117'
  surface-muted: '#122229'
  text: '#ffffff'
  text-warm: '#f8faf7'
  text-muted: '#c8d6d9'
  border: '#34464d'
  border-strong: '#66777d'
  ice: '#86e8ff'
  success: '#65d6a6'
  danger: '#ff7474'
typography:
  display:
    fontFamily: 'DM Serif Display, Georgia, Times New Roman, serif'
    fontSize: '3rem'
    fontWeight: '400'
    lineHeight: '1.08'
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: '1rem'
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: '0.875rem'
    fontWeight: '700'
    lineHeight: '1.25'
rounded:
  control: '8px'
  panel: '12px'
  pill: '999px'
spacing:
  1: '4px'
  2: '8px'
  3: '12px'
  4: '16px'
  5: '24px'
  6: '32px'
  7: '48px'
  8: '76px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.ink}'
  button-secondary:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.text}'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
  navigation-active:
    backgroundColor: '{colors.surface-muted}'
    textColor: '{colors.ice}'
  card:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.text-warm}'
  divider:
    backgroundColor: '{colors.border}'
    textColor: '{colors.text}'
  divider-strong:
    backgroundColor: '{colors.border-strong}'
    textColor: '{colors.text}'
  helper-text:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-muted}'
  status-success:
    backgroundColor: '{colors.success}'
    textColor: '{colors.ink}'
  status-danger:
    backgroundColor: '{colors.danger}'
    textColor: '{colors.ink}'
---

## Overview

One Time is a high-contrast, calm learning environment: near-black foundations,
warm white reading surfaces, decisive yellow calls to action, and restrained ice-blue
for focus and authenticated orientation. The visual language is confident and
structured, never generic or browser-default. Preserve the existing brand manifest as
the implementation source while using this document as the durable design contract.

## Colors

Use black/ink for page foundations, yellow only for the primary action and selected
high-emphasis moments, white/warm white for readable text, and ice for focus,
authenticated navigation, and supporting status. Use muted blue-black surfaces and
defined borders to separate layers. Do not introduce raw route-local palettes, a gray
browser-default select, or color-only status indicators.

## Typography

DM Serif Display is reserved for display moments and key learning emphasis. Body,
labels, controls, and navigation use the local Inter/system stack. Weight and spacing,
not gratuitous font changes, establish hierarchy. Maintain readable line length,
minimum 16px body text, clear labels, and visible error/help text.

## Layout

Role shells share one navigation grammar: header, predictable primary navigation,
contextual section tabs or a horizontal subcategory strip where needed, a readable
content region, and an app footer. Parent and Student routes retain role-appropriate
content while using the same spatial and navigation logic.

Desktop app shells use a stable header/sidebar/content geometry. Mobile transforms the
sidebar into a focus-trapped drawer with an overlay, safe-area padding, clear close
control, and preserved navigation order. Horizontal subcategory strips scroll
intentionally without hiding selected context.

### Spacing

Use the 4/8/12/16/24/32/48/76px scale. Give learning content deliberate breathing
room, keep dense operational surfaces scannable, and align controls to consistent
gaps. Minimum interactive targets are 44px in either dimension.

## Elevation & Depth

Use restrained dark-surface elevation for panels and drawers; borders define ordinary
separation while the drawer overlay and dialog elevation establish temporary focus.
Do not use decorative gradients, arbitrary drop shadows, or elevation to hide state.

## Shapes

Controls use the control radius, panels use the panel radius, and pills are reserved
for compact filters/status. Borders are visible on dark surfaces. Focus uses a
3px ice outline with 3px offset; never remove focus visibility.

## Components

Use the existing brand-system Logo, Button, Link, Input, Select, Checkbox, Alert,
Badge, Card, ListCardRow, Table, Drawer, Dialog, EmptyState, LoadingState,
ErrorState, FilterStrip, Footer, Header, Toolbar, SectionTabs, MetricTile,
StatusChip, MobileCard, StatePanel, ToastBanner, MediaFrame, and ActivityTimeline.
Do not create route-local substitutes for these primitives.

Forms are branded, labeled, keyboard-operable, and explicit about validation. Selects
must use the brand control rather than the browser-default gray control. Error text,
required state, disabled state, and success feedback must not rely only on color.

## Do's and Don'ts

Design from mobile upward at 360px, 390px, tablet, and desktop. Avoid horizontal
page overflow, preserve readable text and touch targets, and keep the primary task
visible without an old-shell flash during route/bundle transitions. Respect reduced
motion: animations become static or shortened without suppressing essential status.

### States and accessibility

Every route defines loading, empty, error, permission/denied, offline, slow,
session-expired, and not-found behavior as applicable. State panels explain the
situation, preserve safe recovery actions, and never expose private data. Meet WCAG
2.2 AA contrast, use semantic landmarks and labels, support keyboard navigation,
honor reduced motion, and use logical spacing that remains safe for RTL content.
