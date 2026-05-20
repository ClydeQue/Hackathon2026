// Centralised font-family names. The actual font files are loaded once at
// app boot in src/app/_layout.tsx from assets/fonts/. Use these tokens in
// screen styles so a future font swap only requires changing this file.
//
// Work Sans is a variable font on the wght axis — set fontFamily: WORK_SANS
// .regular (or .italic) and use the normal `fontWeight` style prop; RN
// picks the right weight from the variable font at render time.

export const WORK_SANS = {
  regular: 'WorkSans',
  italic: 'WorkSans-Italic',
} as const;

export const DM_SERIF = {
  regular: 'DMSerifDisplay-Regular',
  italic: 'DMSerifDisplay-Italic',
} as const;
