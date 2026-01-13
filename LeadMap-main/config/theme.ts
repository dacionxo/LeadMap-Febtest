/**
 * NextDeal Theme Configuration
 * 
 * This file contains all key theme data, font information, and design tokens
 * for the NextDeal website. Reference this file when making design changes.
 */

// ============================================================================
// BRANDING
// ============================================================================
export const BRAND = {
  name: 'NextDeal',
  tagline: 'The AI lead platform for faster, smarter closings',
  description: 'Access verified, high-intent leads curated for your market — all in one clean, intuitive platform built for modern real-estate professionals.',
} as const;

// ============================================================================
// COLORS
// ============================================================================
export const COLORS = {
  background: '#f7faff',
  surface: '#ffffff',
  primary: {
    DEFAULT: '#1179fc',
    hover: '#0366e3',
    soft: '#cde3fe',
    50: '#e6f2ff',
    100: '#cde3fe',
    200: '#9bc7fd',
    300: '#69abfc',
    400: '#378ffb',
    500: '#1179fc',
    600: '#0366e3',
    700: '#0250b8',
    800: '#013a8d',
    900: '#002462',
  },
  secondary: {
    DEFAULT: '#0366e3',
    50: '#e6f2ff',
    100: '#cde3fe',
    200: '#9bc7fd',
    300: '#69abfc',
    400: '#378ffb',
    500: '#0366e3',
    600: '#0250b8',
    700: '#013a8d',
    800: '#002462',
    900: '#001237',
  },
  accent: {
    DEFAULT: '#fc9411',
    50: '#fff4e6',
    100: '#ffe9cc',
    200: '#ffd399',
    300: '#ffbd66',
    400: '#ffa733',
    500: '#fc9411',
    600: '#d67a0e',
    700: '#b0600b',
    800: '#8a4608',
    900: '#642c05',
  },
  text: {
    primary: '#0b1220',
    muted: '#516075',
  },
  border: {
    DEFAULT: '#d6e3ff',
    divider: '#d6e3ff',
  },
  success: {
    DEFAULT: '#22c55e',
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  warning: {
    DEFAULT: '#f59e0b',
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  danger: {
    DEFAULT: '#ef4444',
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================
export const TYPOGRAPHY = {
  // Font Families
  fonts: {
    heading: 'Montserrat', // For h1-h6, bold headings
    body: 'Inter', // For body text, paragraphs, labels
    ui: 'Lato', // For buttons, badges, UI elements
  },
  
  // Font Weights
  weights: {
    heading: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    body: {
      normal: 400,
      medium: 500,
      semibold: 600,
    },
    ui: {
      normal: 400,
      bold: 700,
    },
  },
  
  // Hero Headline (Apollo.io style)
  heroHeadline: {
    mobile: 'text-[44px] tracking-[-0.88px] leading-none',
    tablet: 'tablet:text-[56px] tablet:tracking-[-1.12px] tablet:leading-none',
    desktopS: 'desktop-s:text-[64px] desktop-s:tracking-[-1.28px] desktop-s:leading-[90%]',
    desktop: 'desktop:text-[72px] desktop:tracking-[-1.44px] desktop:leading-[90%]',
    desktopXL: 'desktop-xl:text-[80px] desktop-xl:tracking-[-1.6px] desktop-xl:leading-[90%]',
    maxWidth: {
      tablet: 'tablet:max-w-[500px]',
      desktopS: 'desktop-s:max-w-[700px]',
      desktop: 'desktop:max-w-[900px]',
      desktopXL: 'desktop-xl:max-w-[1100px]',
    },
  },
  
  // Testimonial Quote (Apollo.io style - 3 lines)
  testimonial: {
    mobile: 'text-[24px] tracking-[-0.48px] leading-[110%]',
    tablet: 'tablet:text-[28px] tablet:tracking-[-0.56px] tablet:leading-[110%]',
    desktopS: 'desktop-s:text-[32px] desktop-s:tracking-[-0.64px] desktop-s:leading-[110%]',
    desktop: 'desktop:text-[36px] desktop:tracking-[-0.72px] desktop:leading-[110%]',
    desktopXL: 'desktop-xl:text-[40px] desktop-xl:tracking-[-0.8px] desktop-xl:leading-[110%]',
    maxWidth: {
      desktopS: 'desktop-s:max-w-[520px]',
      desktop: 'desktop:max-w-[650px]',
      desktopXL: 'desktop-xl:max-w-[800px]',
    },
  },
  
  // Subheadline
  subheadline: {
    mobile: 'text-lg',
    tablet: 'tablet:text-xl',
    desktopS: 'desktop-s:text-2xl',
  },
} as const;

// ============================================================================
// SPACING & LAYOUT
// ============================================================================
export const LAYOUT = {
  // Container padding/margins (matches banner)
  container: {
    horizontal: 'mx-4 sm:mx-6 lg:mx-8',
    padding: 'px-4 sm:px-6 lg:px-8',
  },
  
  // Responsive Breakpoints (from tailwind.config.js)
  breakpoints: {
    tablet: '768px',
    desktopS: '1024px',
    desktop: '1280px',
    desktopXL: '1536px',
  },
  
  // White Overlay Container
  overlay: {
    className: 'bg-neutral-light dark:bg-neutral-dark rounded-2xl sm:rounded-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] overflow-hidden border border-gray-200 dark:border-gray-800',
    margin: 'mt-16 mx-4 sm:mx-6 lg:mx-8 mb-8',
  },
} as const;

// ============================================================================
// COMPONENT STYLES
// ============================================================================
export const COMPONENTS = {
  // Navigation
  nav: {
    height: 'h-16',
    link: 'text-sm font-normal',
  },
  
  // Buttons
  button: {
    primary: 'bg-primary text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors',
    secondary: 'bg-transparent border border-black dark:border-white text-black dark:text-white font-normal rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
  },
  
  // Cards
  card: {
    base: 'bg-neutral-light dark:bg-neutral-dark rounded-lg border border-gray-200 dark:border-gray-700 p-6',
  },
} as const;

// ============================================================================
// CONTENT
// ============================================================================
export const CONTENT = {
  customerCount: '1,000',
  testimonial: {
    quote: '"Every agent is more productive with NextDeal. We closed 75% more deals while cutting prospecting time in half."',
    author: 'Tanza James',
    role: 'Real Estate Broker',
  },
  benefits: [
    {
      label: '75% increase in closed deals',
      value: '75%',
    },
    {
      label: '2X agent efficiency',
      value: '2X',
    },
    {
      label: '50% lower prospecting costs',
      value: '50%',
    },
  ],
} as const;

