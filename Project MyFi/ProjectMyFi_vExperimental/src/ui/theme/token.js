/**
 * Theme tokens (V1)
 * Keep tiny and stable. Parts consume tokens; uplift uses CSS.
 */
export const TOKENS = {
  space: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 22
  },
  radius: {
    sm: 10,
    md: 16
  },
  chrome: {
    // aliases; actual values come from core/chrome.js (measured)
    headerVar: '--chrome-header-h',
    footerVar: '--chrome-footer-h'
  }
};
