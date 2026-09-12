import type { SVGProps } from "react";

const defaults: SVGProps<SVGSVGElement> = {
  fill: "none",
  viewBox: "0 0 24 24",
  strokeWidth: 2,
  stroke: "currentColor",
};

export function WalletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5zm0 0H16.5A1.5 1.5 0 0 0 15 13.5v1a1.5 1.5 0 0 0 1.5 1.5H21M5 5v0a2 2 0 0 1 2-2h8v0a2 2 0 0 1 2 2v0"
      />
    </svg>
  );
}

export function TrendingUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M23 6l-9.5 9.5-5-5L1 18"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 6h6v6"
      />
    </svg>
  );
}

export function TrendingDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M23 18l-9.5-9.5-5 5L1 6"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 18h6v-6"
      />
    </svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
      />
    </svg>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function RepeatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 11V9a4 4 0 0 1 4-4h14"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 23l-4-4 4-4" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 13v2a4 4 0 0 1-4 4H3"
      />
    </svg>
  );
}

export function ZapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <polygon
        strokeLinecap="round"
        strokeLinejoin="round"
        points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
      />
    </svg>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4"
      />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export function AlertCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16h.01" />
    </svg>
  );
}

export function DatabaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"
      />
    </svg>
  );
}
