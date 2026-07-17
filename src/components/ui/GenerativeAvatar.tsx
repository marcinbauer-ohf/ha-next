import { clsx } from 'clsx';

/**
 * Deterministic, dependency-free generative avatar for people with no photo.
 *
 * The look is a soft "marble" gradient (three offset/rotated/scaled colour
 * blobs blurred together — the Boring Avatars technique, MIT) seeded from the
 * person's name, so every household member gets a stable, unique tile. Palettes
 * are warm + domestic (clay, amber, sage, dusk) so it reads as "home" rather
 * than a crypto-wallet identicon, and a faint roof-line motif nods at living in
 * a house. Initials sit on top for instant recognition.
 *
 * No name → still deterministic on whatever seed we get (falls back to "U").
 */

// Curated warm/earthy palettes — one is chosen per person, then three colours
// are drawn from it. Every palette is internally harmonious so any pick looks
// intentional. Hues stay away from harsh neon to keep the dashboard calm.
const PALETTES: readonly (readonly [string, string, string, string])[] = [
  ['#E9A178', '#D97B54', '#F3C9A6', '#B65C3A'], // terracotta / clay
  ['#E8C07D', '#D99A4E', '#F4DDA8', '#B87A34'], // amber / honey
  ['#9DB17C', '#6F8F5A', '#C4D4A3', '#4E6B3C'], // sage / olive
  ['#E4A2A2', '#C77878', '#F1C7C7', '#A65656'], // dusty rose
  ['#8FB0B8', '#5E8C96', '#BFD6DB', '#3F6970'], // muted teal
  ['#B6A3D4', '#8C74B8', '#D6C9EC', '#6A519A'], // dusk / lavender
  ['#D9A66B', '#B98247', '#EFCF9E', '#8C5F2E'], // ochre
];

/** Classic string hash (×31, wrapped to signed 32-bit). Stable per name. */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** The nth decimal digit of a number. */
function getDigit(n: number, ntn: number): number {
  return Math.floor((n / 10 ** ntn) % 10);
}

/** A signed value in [-range, range); sign flips on the parity of a chosen digit. */
function unit(n: number, range: number, parityDigit?: number): number {
  const value = n % range;
  if (parityDigit != null && getDigit(n, parityDigit) % 2 === 0) return -value;
  return value;
}

/** YIQ contrast pick — black or white text over a hex background. */
function contrastColor(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? 'rgba(30,22,16,0.92)' : 'rgba(255,252,247,0.95)';
}

const VIEW = 80;
const ELEMENTS = 3;

interface GenerativeAvatarProps {
  /** Seed — normally the person's name. */
  seed: string;
  /** Initials to overlay; omit to show marble only. */
  initials?: string;
  /** Show the faint roof-line home motif (auto-off below ~32px). */
  showMotif?: boolean;
  /** Rendered edge length in px — drives whether the motif/initials show. */
  pxSize?: number;
  className?: string;
}

export function GenerativeAvatar({
  seed,
  initials,
  showMotif = true,
  pxSize = 40,
  className,
}: GenerativeAvatarProps) {
  const num = hashString(seed || 'U');
  const palette = PALETTES[num % PALETTES.length];

  // Three blurred blobs. Each is decorrelated by multiplying the seed hash.
  const blobs = Array.from({ length: ELEMENTS }, (_, i) => {
    const h = hashString(seed || 'U') * (i + 1);
    return {
      color: palette[(num + i) % palette.length],
      tx: unit(h, VIEW / 10, 1),
      ty: unit(h, VIEW / 10, 2),
      rotate: unit(h, 360, 1),
      scale: 1.2 + (h % (VIEW / 20)) / 10,
    };
  });

  const ink = contrastColor(palette[0]);
  const tiny = pxSize < 32;
  const withMotif = showMotif && !tiny;
  // Stable per-person unique id so multiple avatars don't share SVG defs.
  const uid = `ga-${num.toString(36)}`;

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={clsx('rounded-full', className)}
      role="img"
      aria-label={initials ? `${initials} avatar` : 'avatar'}
    >
      <defs>
        <filter id={`${uid}-blur`}>
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <clipPath id={`${uid}-clip`}>
          <circle cx={VIEW / 2} cy={VIEW / 2} r={VIEW / 2} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${uid}-clip)`}>
        {/* base fill */}
        <rect width={VIEW} height={VIEW} fill={blobs[0].color} />
        {/* blurred colour blobs = the marble gradient */}
        <g filter={`url(#${uid}-blur)`}>
          {blobs.slice(1).map((b, i) => (
            <rect
              key={i}
              width={VIEW}
              height={VIEW}
              fill={b.color}
              transform={`translate(${b.tx} ${b.ty}) rotate(${b.rotate} ${VIEW / 2} ${VIEW / 2}) scale(${b.scale})`}
            />
          ))}
        </g>

        {/* faint roof-line home motif — the "living in a house" nod */}
        {withMotif && (
          <g
            fill="none"
            stroke={ink}
            strokeOpacity={0.14}
            strokeWidth={2.4}
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d="M20 40 L40 24 L60 40" />
            <path d="M26 40 L26 58 L54 58 L54 40" />
          </g>
        )}

        {/* top-lit sheen for depth */}
        <rect width={VIEW} height={VIEW} fill={`url(#${uid}-sheen)`} opacity={0.35} />
        <radialGradient id={`${uid}-sheen`} cx="32%" cy="26%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </g>

      {initials && !tiny && (
        <text
          x="50%"
          y="52%"
          dominantBaseline="central"
          textAnchor="middle"
          fill={ink}
          fontSize={initials.length > 1 ? 30 : 36}
          fontWeight={600}
          fontFamily="inherit"
          style={{ letterSpacing: '0.02em' }}
        >
          {initials}
        </text>
      )}
    </svg>
  );
}
