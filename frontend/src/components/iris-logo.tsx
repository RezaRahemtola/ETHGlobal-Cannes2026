interface IrisLogoProps {
  size?: number;
  className?: string;
}

export function IrisLogo({ size = 22, className }: IrisLogoProps) {
  const id = `iris-gradient-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-mint)" />
          <stop offset="50%" stopColor="var(--brand-blue)" />
          <stop offset="100%" stopColor="var(--brand-purple)" />
        </linearGradient>
      </defs>
      <path
        d="M22 44 Q22 20 32 16 Q42 20 42 44"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M26 46 Q26 26 32 22 Q38 26 38 46"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M30 48 Q30 32 32 28 Q34 32 34 48"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M16 14 L32 8 L48 14 L48 36 Q48 52 32 58 Q16 52 16 36Z"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2"
        opacity="0.35"
      />
    </svg>
  );
}
