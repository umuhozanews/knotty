/**
 * IshuriHUB Mobile Design System Tokens
 * Faithfully extracted from IshuriHUB Mobile Design.html
 */

export const Colors = {
  // Brand & Greens
  primary: '#15803D',        // Button green, active badge border, primary icons
  primaryDark: '#14532D',    // Deep forest green (Attendance hero card, Gate hero card)
  primaryLight: '#E3F5E9',   // Light green tint (active tab bar item, icon chip backgrounds)
  primaryTextLight: '#D8F3E1',// Subtitle on dark green card
  secondaryGreen: '#166534', // Secondary green (Present stat, balance highlight, links)
  tealAvatar: '#0F766E',     // User avatar AU (Admin User)
  studentAvatar: '#A21CAF',  // Student avatar TJ (Tumukunde Josiane purple)

  // Surface & Neutrals
  background: '#F5F8F6',     // App background
  surface: '#FFFFFF',        // Card & header background
  surfaceElevated: '#FFFFFF',// Modal / sheet background
  surfaceMuted: '#E8EEEB',   // Tab segment container background, border divider

  // Text
  textPrimary: '#12211B',    // Main headings, titles, active items
  textSecondary: '#4F6058',  // Secondary labels, subtitles, descriptions
  textTertiary: '#6B7C74',   // Hints, toggle switch off state
  textWhite: '#FFFFFF',      // White text on dark green / colored chips

  // Borders & Dividers
  border: '#DFE7E3',         // Subtle card & section border
  borderInput: '#C9D6D0',    // Form input border, inactive chip border
  borderDivider: '#E8EEEB',  // Row divider border

  // Status & Semantics
  present: '#166534',
  presentBg: '#E3F5E9',
  absent: '#B91C1C',
  absentBg: '#FEF2F2',
  absentBorder: '#FECACA',
  late: '#92400E',
  lateBg: '#FEF3C7',
  excused: '#1D4ED8',
  excusedBg: '#DBEAFE',

  // Matrix Role Levels
  matrixManage: '#15803D',
  matrixManageFg: '#FFFFFF',
  matrixView: '#E3F5E9',
  matrixViewFg: '#14532D',
  matrixOwn: '#DBEAFE',
  matrixOwnFg: '#1E3A8A',
  matrixTotals: '#FEF3C7',
  matrixTotalsFg: '#78350F',
  matrixNone: 'transparent',
  matrixNoneFg: '#4F6058',
};

export const Typography = {
  fontFamily: 'System', // Fallback to system if Plus Jakarta Sans not loaded
  monoFamily: 'monospace',
  sizes: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 16,
    xl: 18,
    xxl: 20,
    title: 22,
    hero: 24,
    display: 26,
    matrixTitle: 34,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};

export const Radii = {
  xs: 8,
  sm: 10,
  pill: 11,
  md: 12,
  lg: 14,
  card: 16,
  cardLg: 18,
  hero: 20,
  sheet: 22,
  full: 999,
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 10,
  base: 12,
  lg: 14,
  xl: 16,
  xxl: 18,
  section: 20,
};
