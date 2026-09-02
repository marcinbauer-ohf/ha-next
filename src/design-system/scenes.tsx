'use client';

/**
 * Design-system scenes — the illustration kit (door, keys, keychain).
 * Same tokens, but these are brand artwork, not general-purpose controls.
 * Consumers must inject SCENES_KEYFRAMES once (a <style> tag) for the idle
 * motion (key swing) and door swings to run.
 */

import { motion } from 'framer-motion';
import { capColorFor, color, keyHash } from './tokens';

export const SCENES_KEYFRAMES = `
@keyframes obv2-swing { 0%, 100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
@keyframes obv2-door-once { 0% { transform: rotateY(0deg); } 45% { transform: rotateY(-34deg); } 100% { transform: rotateY(0deg); } }
@keyframes obv2-door-hold { 0% { transform: rotateY(0deg); } 13% { transform: rotateY(-46deg); } 80% { transform: rotateY(-44deg); } 100% { transform: rotateY(0deg); } }
`;

// ── Keys: every person in the home holds a key ───────────────────────────────
export function KeySvg({
  cutSeed,
  styleSeed,
  color: keyColor = color.ink,
  capColor,
  height = 88,
}: {
  /** Cuts the valley dips — for the admin this is the password. */
  cutSeed: string;
  /** Shapes the head and blade — the person's name/username. */
  styleSeed?: string;
  color?: string;
  /** Overrides the seed-picked cap color — grayed placeholder keys use this. */
  capColor?: string;
  height?: number;
}) {
  const cut = keyHash(cutSeed);
  const bits = Array.from({ length: 4 }, (_, i) => ((cut >> (i * 4)) & 15) / 15);
  const s = keyHash(styleSeed ?? cutSeed);
  // The style seed also picks the kind of key: a classic cut key, a modern
  // dimple key, or a key card.
  const kind = (s >> 6) % 3;
  const headR = 6.5 + (s & 3) * 0.7;
  const headStroke = 5 + ((s >> 2) & 3) * 0.7;
  // Every person's key wears a small colored cap around the hole.
  const cap = capColor ?? capColorFor(styleSeed ?? cutSeed);

  if (kind === 2) {
    // Key card: credit-card proportions (CR80, ~1.586:1) hung in portrait
    // from a punched hole. The password embosses the number groups.
    return (
      <svg width={height * 0.64} height={height} viewBox="0 0 41 64" fill="none">
        <path
          fillRule="evenodd"
          d="M4 1 L37 1 A3 3 0 0 1 40 4 L40 60 A3 3 0 0 1 37 63 L4 63 A3 3 0 0 1 1 60 L1 4 A3 3 0 0 1 4 1 Z M20.5 3.5 a3 3 0 1 0 0 6 a3 3 0 1 0 0 -6 Z"
          fill={keyColor}
        />
        {/* chip and magstripe */}
        <rect x="6" y="14" width="9" height="7" rx="1.5" fill="#ffffff" opacity="0.45" />
        <rect x="1" y="24" width="39" height="7" fill={cap} />
        {/* the card number — each group embossed by the password */}
        {bits.map((b, i) => (
          <rect
            key={i}
            x={5 + i * 8.2}
            y={47 + (b - 0.5) * 3}
            width={4.5 + b * 3}
            height="3"
            rx="1.5"
            fill="#ffffff"
            opacity="0.45"
          />
        ))}
        <rect x="5" y="55" width="14" height="2.5" rx="1.25" fill="#ffffff" opacity="0.3" />
      </svg>
    );
  }

  const L = 11 + ((s >> 4) & 1) * 2;
  const R = 20;
  const pointed = ((s >> 5) & 1) === 1;
  let blade: string;
  if (kind === 1) {
    // Dimple key: a straight blade, the code drilled in as dimples.
    blade = `M${L} 18 L${R} 18 L${R} 59 Q${R} 62 ${R - 3} 62 L${L + 3} 62 Q${L} 62 ${L} 59 Z`;
  } else {
    blade = `M${L} 18 L${R} 18 `;
    bits.forEach((b, i) => {
      const y = 27 + i * 8;
      // Cap the cut depth: the blade is 7-9 units wide, and a valley deeper
      // than ~5.5 pinches it to a sliver.
      const depth = 2.5 + b * 3;
      blade += `L${R} ${y - 3} L${R - depth} ${y} L${R} ${y + 3} `;
    });
    blade += pointed
      ? `L${R} 57 L16 62 L${L} 58 Z`
      : `L${R} 59 Q${R} 62 ${R - 3} 62 L${L + 3} 62 Q${L} 62 ${L} 59 Z`;
  }
  const mid = (L + R) / 2;
  return (
    <svg width={height * 0.5} height={height} viewBox="0 0 32 64" fill="none">
      <path d={blade} fill={keyColor} stroke={keyColor} strokeWidth="1.5" strokeLinejoin="round" />
      {kind === 1 &&
        // The password drills the dimples: position and depth per bit, spread
        // wide enough that a new password visibly re-cuts the pattern.
        bits.map((b, i) => (
          <circle key={i} cx={mid + (b - 0.5) * 5} cy={28 + i * 8} r={1.2 + b * 1.4} fill={color.surface} />
        ))}
      {/* thin body-coloured collar, then the cap on top of everything.
          The bow drops just enough that its outer edge (r + stroke/2) never
          pokes above the viewBox, where the svg would crop it flat. */}
      <rect x="12" y={15.5} width="8" height="4" rx="2" fill={keyColor} />
      <circle cx="16" cy={Math.max(10, headR + headStroke / 2 + 0.75)} r={headR} stroke={cap} strokeWidth={headStroke} />
    </svg>
  );
}

export function Keychain({
  keys,
  keyHeight = 88,
  ringSize = 60,
}: {
  keys: { id: string; cutSeed: string; styleSeed?: string; color: string; capColor?: string }[];
  keyHeight?: number;
  ringSize?: number;
}) {
  const n = keys.length;
  return (
    <div className="relative flex flex-col items-center">
      <div
        className="rounded-full border-white bg-transparent shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        style={{ width: ringSize, height: ringSize, borderWidth: ringSize * 0.16 }}
      />
      {/* keys tuck up so the ring passes through their holes — the punched
          hole reveals the ring band behind it */}
      <div className="relative w-full" style={{ height: keyHeight + 4, marginTop: -ringSize * 0.31 }}>
        {keys.map((k, i) => (
          <div key={k.id} className="absolute left-1/2 -translate-x-1/2">
            <motion.div
              initial={{ rotate: 0, y: -24, opacity: 0 }}
              animate={{ rotate: (i - (n - 1) / 2) * 18, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              style={{ transformOrigin: 'top center' }}
            >
              {/* each key pendulums gently on the ring, out of phase */}
              <div
                style={{
                  transformOrigin: 'top center',
                  animation: `obv2-swing 3.6s ease-in-out ${i * 0.55}s infinite`,
                }}
              >
                <KeySvg cutSeed={k.cutSeed} styleSeed={k.styleSeed} color={k.color} capColor={k.capColor} height={keyHeight} />
              </div>
            </motion.div>
          </div>
        ))}
      </div>
      {/* the ring's front arc passes back OVER the keys, so they read as
          threaded onto the ring rather than stacked behind it */}
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full border-white bg-transparent"
        style={{ width: ringSize, height: ringSize, borderWidth: ringSize * 0.16, clipPath: 'inset(50% 0 0 0)' }}
      />
    </div>
  );
}

// ── The door: the home itself, its name written on it ───────────────────────
export function Door({
  name,
  height = 345,
  poked = false,
  held = false,
  open = false,
  onPokeEnd,
}: {
  name?: string;
  height?: number;
  /** One-shot open/close on tap; onPokeEnd fires when the swing finishes. */
  poked?: boolean;
  /** Longer open-and-stay swing — someone is coming out. */
  held?: boolean;
  /** The door gave up: stays open (hallway showing) until tapped shut. */
  open?: boolean;
  onPokeEnd?: () => void;
}) {
  const width = Math.round(height * 0.504);
  // The door rests closed — an idle swing kept catching the eye mid-open and
  // reading as "the door is open". It only swings when poked.
  const animation = held
    ? 'obv2-door-hold 4.8s ease-in-out'
    : poked
      ? 'obv2-door-once 1.2s ease-in-out'
      : undefined;
  return (
    // Width pinned to the door: as a plain block this div stretches to its
    // widest sibling-driven parent (the welcome mat), and the doorway layer —
    // inset from THIS box — then pokes out past the door like it's ajar.
    <div className="relative" style={{ perspective: 700, width }}>
      {/* The door frame — without one the panel floats and reads as an OPEN
          door; framed, it reads closed. */}
      <div className="absolute -inset-[9px] rounded-[31px] bg-[#f4f4f4] shadow-[0_2px_10px_rgba(0,0,0,0.05)]" />
      {/* The doorway — hidden behind the door until it swings open. */}
      <div className="absolute inset-[3px] rounded-[24px] bg-[#d7d7d7] overflow-hidden">
        {/* a tiny hallway waits inside: floor, a picture, a coat on its hook */}
        <div className="absolute bottom-0 inset-x-0 h-[15%] bg-[#c9c9c9]" />
        <div className="absolute left-[20%] top-[27%] w-[18%] h-[13%] rounded-[3px] bg-[#efefef]" />
        <span className="absolute right-[24%] top-[27%] size-[5px] rounded-full bg-[#b9b9b9]" />
        <div className="absolute right-[18%] top-[30%] w-[16%] h-[26%] rounded-t-full rounded-b-[5px] bg-[#c2c2c2]" />
      </div>
      <div
        className="relative rounded-[24px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
        onAnimationEnd={poked ? onPokeEnd : undefined}
        style={{
          width,
          height,
          transformOrigin: 'left center',
          animation,
          // "Gave up" state: no keyframes, just a sustained swing held by a
          // transition until the next tap shuts it.
          transform: open ? 'rotateY(-48deg)' : undefined,
          transition: 'transform 0.9s ease-in-out',
        }}
      >
        {/* the home name — the first thing the user sets up */}
        {name ? (
          <span
            className="absolute left-0 right-0 text-center font-semibold px-2 truncate"
            style={{ color: color.text2, top: Math.round(height * 0.19), fontSize: Math.max(12, Math.round(width * 0.105)), letterSpacing: '-0.02em' }}
          >
            {name}
          </span>
        ) : (
          <div
            className="absolute top-[68px] left-1/2 -translate-x-1/2 h-[10px] rounded-full bg-[#e6e6e6]"
            style={{ width: Math.round(width * 0.41) }}
          />
        )}
        {/* knob */}
        <div className="absolute right-[16px] top-[54%] size-[14px] rounded-full bg-[#e6e6e6]" />
      </div>
    </div>
  );
}
