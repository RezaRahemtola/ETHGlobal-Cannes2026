interface IrisLogoProps {
  size?: number;
  className?: string;
}

export function IrisLogo({ size = 22, className }: IrisLogoProps) {
  const id = `iris-gradient-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-mint)" />
          <stop offset="50%" stopColor="var(--brand-blue)" />
          <stop offset="100%" stopColor="var(--brand-purple)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="4" fill={`url(#${id})`} />
      <circle
        cx="12"
        cy="12"
        r="7.5"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="1"
        opacity="0.5"
      />
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="0.6"
        opacity="0.25"
      />
    </svg>
  );
}
