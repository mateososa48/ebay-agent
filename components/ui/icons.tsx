import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Queue: (p: IconProps) => (
    <Base {...p}>
      <path d="M3 5.5h18M3 12h18M3 18.5h18" opacity={0.35} />
      <path d="M3 12h5l1.5 2.5h5L16 12h5" />
      <rect x="3" y="4" width="18" height="16" rx="3" />
    </Base>
  ),
  Camera: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1l1-1.5h5L14.5 6h3A2.5 2.5 0 0 1 20 8.5V17a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17V8.5Z" />
      <circle cx="12" cy="12.5" r="3.2" />
      <path d="M17.5 9.2h.01" />
    </Base>
  ),
  Grid: (p: IconProps) => (
    <Base {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </Base>
  ),
  Sliders: (p: IconProps) => (
    <Base {...p}>
      <path d="M5 4v6M5 14v6M12 4v3M12 11v9M19 4v9M19 17v3" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="9" r="2" />
      <circle cx="19" cy="15" r="2" />
    </Base>
  ),
  Sun: (p: IconProps) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </Base>
  ),
  Moon: (p: IconProps) => (
    <Base {...p}>
      <path d="M20 13.5A8 8 0 0 1 10.5 4a7 7 0 1 0 9.5 9.5Z" />
    </Base>
  ),
  Check: (p: IconProps) => (
    <Base {...p}>
      <path d="M5 12.5 10 17.5 19 6.5" />
    </Base>
  ),
  Shield: (p: IconProps) => (
    <Base {...p}>
      <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.2-7 9-4.1-1.8-7-4.8-7-9V6l7-2.5Z" />
      <path d="M8.8 12 11 14.2 15.4 9.6" />
    </Base>
  ),
  Alert: (p: IconProps) => (
    <Base {...p}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4.5M12 17.2h.01" />
    </Base>
  ),
  Clock: (p: IconProps) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  ),
  Sparkle: (p: IconProps) => (
    <Base {...p}>
      <path d="M12 3.5c.6 3.9 1.6 4.9 5.5 5.5-3.9.6-4.9 1.6-5.5 5.5-.6-3.9-1.6-4.9-5.5-5.5 3.9-.6 4.9-1.6 5.5-5.5Z" />
      <path d="M18.5 14.5c.3 1.7.7 2.1 2.5 2.5-1.8.4-2.2.8-2.5 2.5-.3-1.7-.7-2.1-2.5-2.5 1.8-.4 2.2-.8 2.5-2.5Z" />
    </Base>
  ),
  Tag: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 11V5.5A1.5 1.5 0 0 1 5.5 4H11l8.5 8.5a1.5 1.5 0 0 1 0 2.1l-5 5a1.5 1.5 0 0 1-2.1 0L4 11Z" />
      <circle cx="8" cy="8" r="1.3" />
    </Base>
  ),
  Trend: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 15.5 9.5 10l3 3L20 5.5" />
      <path d="M15.5 5.5H20v4.5" />
    </Base>
  ),
  ArrowUpRight: (p: IconProps) => (
    <Base {...p}>
      <path d="M7 17 17 7M9 7h8v8" />
    </Base>
  ),
  ChevronRight: (p: IconProps) => (
    <Base {...p}>
      <path d="M9 6l6 6-6 6" />
    </Base>
  ),
  Plus: (p: IconProps) => (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  ),
  Photo: (p: IconProps) => (
    <Base {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" />
    </Base>
  ),
  Pencil: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </Base>
  ),
  Box: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 8 12 4l8 4v8l-8 4-8-4V8Z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </Base>
  ),
};
