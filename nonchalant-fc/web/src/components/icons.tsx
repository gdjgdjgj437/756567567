import type { ReactNode, SVGProps } from 'react';

// Thin, rounded stroke icons drawn in the spirit of SF Symbols / Lucide (1.5px stroke on a 24px grid).
const paths: Record<string, ReactNode> = {
  home: <><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h3v-5.5h4v5.5h3a1.5 1.5 0 0 0 1.5-1.5V9.5" /></>,
  upload: <><path d="M12 15.5V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M4.5 14.5v3A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-3" /></>,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  list: <><path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11" /><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.7 2.7L16 9.5" /></>,
  chevron: <path d="m9.5 6 6 6-6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  x: <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />,
  image: <><rect x="3.5" y="4" width="17" height="16" rx="3.5" /><circle cx="9" cy="9.5" r="1.4" /><path d="m20.5 16-4.8-4.8L6 20" /></>,
  external: <><path d="M14 4.5h5.5V10" /><path d="m19.5 4.5-8 8" /><path d="M17.5 14v3.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2H10" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M5.5 15.5v-8a2 2 0 0 1 2-2h8" /></>,
  arrowUp: <><path d="M12 19V5.5" /><path d="m6.5 11 5.5-5.5 5.5 5.5" /></>,
  arrowDown: <><path d="M12 5v13.5" /><path d="m6.5 13 5.5 5.5 5.5-5.5" /></>,
  toTop: <><path d="M5.5 4.5h13" /><path d="M12 20V8" /><path d="m7 12.5 5-5 5 5" /></>,
  trash: <><path d="M4.5 7h15" /><path d="M10 11v5.5M14 11v5.5" /><path d="m6.5 7 .8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" /><path d="M9.5 7V4.5h5V7" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  plane: <path d="M20.5 4 3.5 10.8l6.2 2.3 2.3 6.2z M9.7 13.1 20.5 4" />,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  queue: <><path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9" /></>,
  tag: <><path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-6.7 6.7a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4z" /><path d="M8 8h.01" /></>,
  bolt: <path d="M13 3 5 13.5h6L10.5 21 19 10h-6.2z" />,
  video: <><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10.5 5-2.5v8l-5-2.5" /></>,
  back: <path d="m14.5 6-6 6 6 6" />,
  camera: <><path d="M4.5 8.5h3l1.5-2.5h6l1.5 2.5h3a1 1 0 0 1 1 1v8a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 17.5v-8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.3" /></>,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" /><path d="M19.5 4.5v4h-4" /></>,
  shield: <><path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.6 7 9 4.2-1.4 7-4.8 7-9V6z" /><path d="m9 12 2.2 2.2L15.2 10" /></>,
  trophy: <><path d="M8 4.5h8v5a4 4 0 0 1-8 0z" /><path d="M8 6.5H5v1.5a3 3 0 0 0 3 3M16 6.5h3v1.5a3 3 0 0 1-3 3" /><path d="M12 13.5v3.5M8.5 20h7M9.5 17h5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8h.01" /></>,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, strokeWidth = 1.5, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {paths[name]}
    </svg>
  );
}
