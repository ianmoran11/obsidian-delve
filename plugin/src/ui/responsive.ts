export const BREAKPOINTS = {
  COVER_SCREEN: 320,
  PHONE: 480,
  TABLET: 768,
} as const;

export function isMobileWidth(width = window.innerWidth): boolean {
  return width < BREAKPOINTS.TABLET;
}

export function isCoverScreen(width = window.innerWidth): boolean {
  return width < BREAKPOINTS.PHONE;
}

export function getLayoutClass(width = window.innerWidth): string {
  if (width < BREAKPOINTS.PHONE) return 'delve-layout--cover';
  if (width < BREAKPOINTS.TABLET) return 'delve-layout--phone';
  return 'delve-layout--desktop';
}
