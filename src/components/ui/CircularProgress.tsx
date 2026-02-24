interface CircularProgressProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  children?: React.ReactNode;
}

export function CircularProgress({
  progress,
  size = 32,
  strokeWidth = 3,
  className = 'text-ha-blue',
  trackClassName = 'text-surface-lower',
  children,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block rotate-[-90deg]">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={`stroke-current ${trackClassName}`}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`stroke-current ${className} transition-all duration-1000`}
        />
      </svg>
      {/* Center content */}
      {children && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center leading-none">
          {children}
        </div>
      )}
    </div>
  );
}
