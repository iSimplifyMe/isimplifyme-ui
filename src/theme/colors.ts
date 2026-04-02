/** Auntie Atom — Atomic Horror palette */
export const colors = {
  // Core brand
  cobalt: {
    50: '#e8eeff',
    100: '#c5d4ff',
    200: '#9eb5ff',
    300: '#7496ff',
    400: '#4a77ff',
    500: '#1a3a8a',
    600: '#142d6b',
    700: '#0f214d',
    800: '#091530',
    900: '#040a18',
  },
  fallout: {
    50: '#e6ffe8',
    100: '#b3ffb8',
    200: '#80ff88',
    300: '#4dff58',
    400: '#1aff28',
    500: '#00d40f',
    600: '#00a10b',
    700: '#006e08',
    800: '#003b04',
    900: '#001902',
  },
  hazard: {
    50: '#fff4e6',
    100: '#ffe0b3',
    200: '#ffcc80',
    300: '#ffb84d',
    400: '#ffa41a',
    500: '#e68a00',
    600: '#b36b00',
    700: '#804d00',
    800: '#4d2e00',
    900: '#1a1000',
  },
  // Neutrals — industrial concrete
  concrete: {
    50: '#f5f5f4',
    100: '#e7e5e4',
    200: '#d6d3d1',
    300: '#a8a29e',
    400: '#78716c',
    500: '#57534e',
    600: '#44403c',
    700: '#292524',
    800: '#1c1917',
    900: '#0c0a09',
  },
  // Accent — CRT phosphor
  phosphor: '#33ff33',
  // Alert — radiation
  radiation: '#ccff00',
} as const

export type ColorToken = keyof typeof colors
