'use client';

/**
 * PROTOTYPE — /dev/onboarding-v2 (mobile)
 *
 * New onboarding experience from the Figma exploration (Untitled-Project,
 * node 43:1168). Self-contained on purpose: lives under /dev/ so AppShell
 * chrome is bypassed, uses its own palette (the --ha/* values baked into the
 * Figma frames) and the Onest face already loaded by the root layout. Icons
 * are Tabler throughout, per the brief.
 *
 * Flow: Welcome → How many floors (shelves stack bottom-up) → Areas per floor
 * (chips add "books" onto the focused shelf; some books randomly tip over) →
 * a bare dashboard (Home pill, + adds cards, inert bottom nav).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  IconAccessible,
  IconArrowRight,
  IconArmchair,
  IconBarbell,
  IconBath,
  IconBed,
  IconBriefcase,
  IconCar,
  IconCheck,
  IconChevronLeft,
  IconDoor,
  IconHome,
  IconHorseToy,
  IconMinus,
  IconPlant,
  IconPlus,
  IconSearch,
  IconClockHour4,
  IconSofa,
  IconStairs,
  IconToolsKitchen2,
  IconUser,
  IconWashMachine,
  IconLamp,
  IconMapPin,
  IconBulb,
  IconChevronDown,
  IconCurrentLocation,
  IconPlug,
  IconUserPlus,
  IconX,
  IconEye,
  IconEyeOff,
  IconHeart,
  IconDeviceTv,
  IconDroplet,
  IconLock,
  IconThermometer,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import type { LatLng } from './MapPicker';

// leaflet reads `window` on import — keep it out of the server bundle.
const MapPicker = dynamic(() => import('./MapPicker'), {
  ssr: false,
  loading: () => <div className="w-full h-full rounded-[24px] bg-white/60 animate-pulse" />,
});

// ── Palette (values lifted from the Figma --ha/* tokens) ────────────────────
const SURFACE = '#e6e6e6';
const ACCENT = '#009ac7';
const INK = '#202020';
const TEXT = '#141414';
const TEXT_2 = '#5e5e5e';
const TEXT_DIM = '#989898';

const FLOOR_NAMES = ['Ground floor', 'First floor', 'Second floor', 'Third floor', 'Fourth floor'];
const MAX_FLOORS = FLOOR_NAMES.length;
// Easter egg: whoever builds to the top of the stepper gets a tower.
const floorName = (i: number) => (i === MAX_FLOORS - 1 ? 'The tower 🏰' : FLOOR_NAMES[i]);

const ROOMS: { name: string; Icon: TablerIcon }[] = [
  { name: 'Living room', Icon: IconSofa },
  { name: 'Kitchen', Icon: IconToolsKitchen2 },
  { name: 'Bedroom', Icon: IconBed },
  { name: 'Bathroom', Icon: IconBath },
  { name: 'Office', Icon: IconBriefcase },
  { name: 'Dining room', Icon: IconArmchair },
  { name: 'Hallway', Icon: IconDoor },
  { name: 'Kids room', Icon: IconHorseToy },
  { name: 'Laundry', Icon: IconWashMachine },
  { name: 'Garage', Icon: IconCar },
  { name: 'Gym', Icon: IconBarbell },
  { name: 'Garden', Icon: IconPlant },
  { name: 'Stairway', Icon: IconStairs },
  { name: 'Studio', Icon: IconLamp },
];

// ── Books ────────────────────────────────────────────────────────────────────
interface Book {
  id: string;
  room: string;
  Icon: TablerIcon;
  w: number;
  h: number;
  tone: string;
  /** Degrees. 0 = standing; a handful of books land tipped against a neighbour. */
  lean: number;
}

const BOOK_TONES = ['#ffffff', '#fdfdfd', '#f8f8f8', '#ffffff', ACCENT];

let bookSeq = 0;
function makeBook(room: string, Icon: TablerIcon): Book {
  return {
    id: `book-${bookSeq++}`,
    room,
    Icon,
    w: 30 + Math.round(Math.random() * 12),
    h: 62 + Math.round(Math.random() * 28),
    tone: BOOK_TONES[Math.floor(Math.random() * BOOK_TONES.length)],
    lean: Math.random() < 0.15 ? (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8) : 0,
  };
}

// ── Press button: scales down with a spring and shifts its color on press ───
function Press({
  className,
  style,
  onClick,
  children,
  brighten = false,
  'aria-label': ariaLabel,
}: {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
  /** Dark buttons lighten on press; light ones darken. */
  brighten?: boolean;
  'aria-label'?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      whileTap={{ scale: 0.93, filter: brighten ? 'brightness(1.7)' : 'brightness(0.9)' }}
      transition={{ type: 'spring', stiffness: 600, damping: 32 }}
      className={className}
      style={style}
    >
      {children}
    </motion.button>
  );
}

// ── Shelf + stack ────────────────────────────────────────────────────────────
function Shelf({
  label,
  books,
  dimmed,
  showHeadroom,
  index,
  onSelect,
}: {
  label: string;
  books: Book[];
  dimmed: boolean;
  showHeadroom: boolean;
  index?: number;
  onSelect?: () => void;
}) {
  return (
    <motion.div
      layout
      data-floor={index}
      onClick={onSelect}
      initial={{ opacity: 0, y: 28, scale: 0.92 }}
      animate={{ opacity: dimmed ? 0.4 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 28, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 340, damping: 26 }}
      className={clsx('w-full flex flex-col', onSelect && 'cursor-pointer')}
    >
      {(showHeadroom || books.length > 0) && (
        <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* w-max + mx-auto: centred while the books fit, pannable once a
              crowded floor overflows the shelf. */}
          <div className="w-max min-w-full mx-auto flex items-end justify-center gap-[3px] min-h-[100px] px-6">
            <AnimatePresence>
              {books.map((book) => (
                <motion.div
                  key={book.id}
                  layout
                  initial={{ y: -150, rotate: 0, opacity: 0 }}
                  animate={{ y: 0, rotate: book.lean, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 17, mass: 0.9 }}
                  title={book.room}
                  style={{
                    width: book.w,
                    height: book.h,
                    background: book.tone,
                    transformOrigin: book.lean < 0 ? 'bottom left' : 'bottom right',
                  }}
                  className="rounded-[6px] shrink-0 shadow-[0_2px_4px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col items-center pt-[7px]"
                >
                  <book.Icon size={18} color={book.tone === ACCENT ? '#ffffff' : TEXT_2} stroke={1.75} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      <motion.div layout className="w-full bg-white rounded-full min-h-[44px] flex items-center justify-center px-4">
        <span className="text-[20px] font-semibold tracking-[-0.4px]" style={{ color: TEXT_DIM }}>
          {label}
        </span>
      </motion.div>
    </motion.div>
  );
}

function ShelfStack({
  floors,
  booksByFloor,
  focusIndex,
  onSelect,
}: {
  floors: number;
  booksByFloor: Book[][];
  /** null = no floor focused (floors step); otherwise dims the other shelves. */
  focusIndex: number | null;
  /** When set, tapping a shelf jumps to that floor. */
  onSelect?: (i: number) => void;
}) {
  // Higher floors render first so the ground floor sits at the bottom.
  const order = Array.from({ length: floors }, (_, i) => floors - 1 - i);
  return (
    <div className="w-full min-h-full flex flex-col justify-end gap-3 pb-6">
      <AnimatePresence>
        {order.map((i) => (
          <Shelf
            key={FLOOR_NAMES[i]}
            label={floorName(i)}
            books={booksByFloor[i] ?? []}
            dimmed={focusIndex !== null && i !== focusIndex}
            showHeadroom={focusIndex === i}
            index={i}
            onSelect={onSelect && i !== focusIndex ? () => onSelect(i) : undefined}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Shared chrome ────────────────────────────────────────────────────────────
function PopMenu({
  open,
  items,
  onPick,
  align = 'left',
}: {
  open: boolean;
  items: string[];
  onPick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={clsx(
            'absolute top-[52px] z-10 bg-white rounded-[20px] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col min-w-[220px]',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          {items.map((label) => (
            <Press
              key={label}
              onClick={onPick}
              className="text-left px-4 py-3 rounded-[14px] text-[15px] font-semibold tracking-[-0.3px] hover:bg-[#f3f3f3]"
              style={{ color: TEXT }}
            >
              {label}
            </Press>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CtaButton({
  label,
  onClick,
  arrow = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  arrow?: boolean;
  disabled?: boolean;
}) {
  return (
    <Press
      brighten
      onClick={disabled ? undefined : onClick}
      className={clsx(
        'w-full min-h-[52px] rounded-full flex items-center justify-between px-3 text-white transition-opacity',
        disabled && 'opacity-40 pointer-events-none',
      )}
      style={{ background: INK }}
    >
      <span className="size-[24px]" />
      <span className="text-[16px] font-semibold tracking-[-0.32px]">{label}</span>
      <span className="size-[24px] flex items-center justify-center">{arrow && <IconArrowRight size={20} />}</span>
    </Press>
  );
}

/** Shared pill text input used across the setup steps. */
function PillInput({
  value,
  onChange,
  placeholder,
  secret = false,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Password-style field with a show/hide eye. */
  secret?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="w-full bg-[#f3f3f3] rounded-full min-h-[56px] pl-5 pr-2 flex items-center gap-1">
      <input
        type={secret && !show ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[17px] font-semibold tracking-[-0.34px] placeholder:text-[#989898]"
        style={{ color: TEXT }}
      />
      {value && (
        <Press
          aria-label="Clear"
          onClick={() => onChange('')}
          className="size-[38px] rounded-full flex items-center justify-center shrink-0 bg-white"
        >
          <IconX size={17} color={TEXT_2} />
        </Press>
      )}
      {secret && (
        <Press
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((v) => !v)}
          className="size-[38px] rounded-full flex items-center justify-center shrink-0 bg-white"
        >
          {show ? <IconEyeOff size={17} color={TEXT_2} /> : <IconEye size={17} color={TEXT_2} />}
        </Press>
      )}
    </div>
  );
}

// ── Keys & keychain: every person in the home holds a key ───────────────────
/** Stable hash used to cut and shape keys. */
function keyHash(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function KeySvg({
  cutSeed,
  styleSeed,
  color = INK,
  height = 88,
}: {
  /** Cuts the valley dips — for the admin this is the password. */
  cutSeed: string;
  /** Shapes the head and blade — the person's name/username. */
  styleSeed?: string;
  color?: string;
  height?: number;
}) {
  const cut = keyHash(cutSeed);
  const bits = Array.from({ length: 4 }, (_, i) => ((cut >> (i * 4)) & 15) / 15);
  const s = keyHash(styleSeed ?? cutSeed);
  const headR = 6.5 + (s & 3) * 0.7;
  const headStroke = 5 + ((s >> 2) & 3) * 0.7;
  const L = 11 + ((s >> 4) & 1) * 2;
  const R = 20;
  const pointed = ((s >> 5) & 1) === 1;
  let blade = `M${L} 18 L${R} 18 `;
  bits.forEach((b, i) => {
    const y = 27 + i * 8;
    const depth = 3 + b * 5;
    blade += `L${R} ${y - 3} L${R - depth} ${y} L${R} ${y + 3} `;
  });
  blade += pointed
    ? `L${R} 57 L16 62 L${L} 58 Z`
    : `L${R} 59 Q${R} 62 ${R - 3} 62 L${L + 3} 62 Q${L} 62 ${L} 59 Z`;
  return (
    <svg width={height * 0.5} height={height} viewBox="0 0 32 64" fill="none">
      <circle cx="16" cy="10" r={headR} stroke={color} strokeWidth={headStroke} />
      <path d={blade} fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Keychain({
  keys,
  keyHeight = 88,
  ringSize = 60,
}: {
  keys: { id: string; cutSeed: string; styleSeed?: string; color: string }[];
  keyHeight?: number;
  ringSize?: number;
}) {
  const n = keys.length;
  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-full border-white bg-transparent shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        style={{ width: ringSize, height: ringSize, borderWidth: ringSize * 0.16 }}
      />
      <div className="relative w-full" style={{ height: keyHeight + 4, marginTop: -ringSize * 0.18 }}>
        {keys.map((k, i) => (
          <div key={k.id} className="absolute left-1/2 -translate-x-1/2">
            <motion.div
              initial={{ rotate: 0, y: -24, opacity: 0 }}
              animate={{ rotate: (i - (n - 1) / 2) * 18, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              style={{ transformOrigin: 'top center' }}
            >
              <KeySvg cutSeed={k.cutSeed} styleSeed={k.styleSeed} color={k.color} height={keyHeight} />
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── The door: the home itself, its name written on it ───────────────────────
function Door({
  name,
  height = 345,
  swing = true,
  poked = false,
  onPokeEnd,
}: {
  name?: string;
  height?: number;
  swing?: boolean;
  /** One-shot open/close on tap; onPokeEnd fires when the swing finishes. */
  poked?: boolean;
  onPokeEnd?: () => void;
}) {
  const width = Math.round(height * 0.504);
  const animation = poked
    ? 'obv2-door-once 1.2s ease-in-out'
    : swing
      ? 'obv2-door 9s ease-in-out infinite'
      : undefined;
  return (
    <div className="relative" style={{ perspective: 700 }}>
      {/* The doorway — hidden behind the door until it swings open. */}
      <div className="absolute inset-[3px] rounded-[24px] bg-[#dcdcdc]" />
      <div
        className="relative rounded-[24px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
        onAnimationEnd={poked ? onPokeEnd : undefined}
        style={{
          width,
          height,
          transformOrigin: 'left center',
          animation,
        }}
      >
        {/* the home name — the first thing the user sets up */}
        {name ? (
          <span
            className="absolute top-[60px] left-0 right-0 text-center text-[18px] font-semibold tracking-[-0.36px] px-3 truncate"
            style={{ color: TEXT_2 }}
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

// ── Steps: artwork (slides between steps) + sheet contents (crossfade) ──────
/**
 * The welcome scene sketches the whole flow: the door is the home (its line is
 * the home name, set up first), the keychain is the people who hold keys to
 * it, the framed pin is the location map, the shelf of books is a floor with
 * its areas, and the little switch is the data-sharing choice at the end.
 */
function WelcomeArt({ homeName, userCount }: { homeName: string; userCount: number }) {
  const teaser = useMemo<Book[]>(
    () => [
      { id: 't1', room: '', Icon: IconSofa, w: 20, h: 62, tone: '#ffffff', lean: 0 },
      { id: 't2', room: '', Icon: IconToolsKitchen2, w: 24, h: 50, tone: ACCENT, lean: -10 },
      { id: 't3', room: '', Icon: IconBed, w: 17, h: 68, tone: '#fafafa', lean: 0 },
      { id: 't4', room: '', Icon: IconBath, w: 22, h: 44, tone: '#ffffff', lean: 9 },
    ],
    [],
  );
  const keys = Array.from({ length: Math.max(1, userCount) }, (_, i) => ({
    id: `wk-${i}`,
    cutSeed: `home-${i}`,
    color: i === 0 ? INK : TEXT_2,
  }));
  // Tap micro-interactions: one-shot animations that hand back to the idle
  // sway when they finish. The doorbell actually toggles.
  const [poke, setPoke] = useState<string | null>(null);
  const [bellOn, setBellOn] = useState(true);
  const endPoke = () => setPoke(null);
  return (
    <div className="flex-1 min-h-0 w-full relative">
      {/* The door stands at the left, bleeding off the edge like you're
          standing right in front of it; the wall items hang on the right. */}
      <div
        className="absolute -left-[64px] top-1/2 -translate-y-1/2 cursor-pointer"
        onClick={() => setPoke('door')}
      >
        <Door name={homeName} poked={poke === 'door'} onPokeEnd={endPoke} />
        {/* The mat below the door — a floor holding its area books */}
        <div className="relative mt-[19px]">
          <div className="absolute bottom-[30px] left-[84px] flex items-end gap-[3px]">
            {teaser.map((b) => (
              <div
                key={b.id}
                className="rounded-[5px] shadow-[0_2px_4px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(0,0,0,0.04)]"
                style={{
                  width: Math.round(b.w * 0.75),
                  height: Math.round(b.h * 0.6),
                  background: b.tone,
                  transform: `rotate(${b.lean}deg)`,
                  transformOrigin: b.lean < 0 ? 'bottom left' : 'bottom right',
                }}
              />
            ))}
          </div>
          <div className="w-[174px] h-[39px] rounded-full bg-white" />
        </div>
      </div>
      {/* wall items, hung in a column on the right */}
      <div className="absolute right-[10px] top-1/2 -translate-y-1/2 flex flex-col items-center gap-8">
        {/* the map in a small landscape photo frame */}
        <div
          className="bg-white rounded-[16px] p-2 shadow-[0_2px_6px_rgba(0,0,0,0.06)] cursor-pointer"
          onClick={() => setPoke('frame')}
          onAnimationEnd={poke === 'frame' ? endPoke : undefined}
          style={{
            animation: poke === 'frame' ? 'obv2-pop 0.7s ease' : 'obv2-sway 7s ease-in-out infinite',
          }}
        >
          <div className="w-[80px] h-[58px] rounded-[10px] bg-[#edf3f5] flex items-center justify-center">
            <span style={{ animation: 'obv2-bob 2.4s ease-in-out infinite' }}>
              <IconMapPin size={24} color={ACCENT} />
            </span>
          </div>
        </div>
        {/* the keychain on its hook — tap to jingle */}
        <div
          className="cursor-pointer"
          onClick={() => setPoke('keys')}
          onAnimationEnd={poke === 'keys' ? endPoke : undefined}
          style={{
            transformOrigin: 'top center',
            animation: poke === 'keys' ? 'obv2-jingle 0.8s ease' : 'obv2-sway 8s ease-in-out infinite',
          }}
        >
          <Keychain keys={keys} keyHeight={54} ringSize={36} />
        </div>
        {/* the data-sharing doorbell — tap to flip it */}
        <Press
          aria-label="Data sharing"
          onClick={() => setBellOn((v) => !v)}
          className="bg-white rounded-full p-2 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
        >
          <div
            className="w-[34px] h-[20px] rounded-full p-[2px] transition-colors duration-200"
            style={{ background: bellOn ? ACCENT : '#e3e3e3' }}
          >
            <span
              className="block size-[16px] rounded-full bg-white transition-transform duration-200"
              style={{ transform: bellOn ? 'translateX(14px)' : undefined }}
            />
          </div>
        </Press>
      </div>
    </div>
  );
}

// ── Areas: the scrollable shelf stack (art) and the chip rail (sheet) ───────
function AreasArt({
  floors,
  booksByFloor,
  floorIndex,
  onSelectFloor,
}: {
  floors: number;
  booksByFloor: Book[][];
  floorIndex: number;
  onSelectFloor: (i: number) => void;
}) {
  const [stackScrolled, setStackScrolled] = useState(false);
  // Keep the focused shelf in view when hopping floors via tap or Continue.
  useEffect(() => {
    document
      .querySelector(`[data-floor="${floorIndex}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [floorIndex]);
  return (
    <div className="relative flex-1 min-h-0">
      <div
        className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => setStackScrolled(e.currentTarget.scrollTop > 8)}
      >
        <ShelfStack floors={floors} booksByFloor={booksByFloor} focusIndex={floorIndex} onSelect={onSelectFloor} />
      </div>
      <div
        aria-hidden
        className={clsx(
          'absolute top-0 inset-x-0 h-10 pointer-events-none transition-opacity duration-200',
          stackScrolled ? 'opacity-100' : 'opacity-0',
        )}
        style={{ background: `linear-gradient(to bottom, ${SURFACE}, transparent)` }}
      />
    </div>
  );
}

function AreasSheet({
  floorIndex,
  booksByFloor,
  toggleRoom,
  addCustomRoom,
  customRooms,
  onNext,
}: {
  floorIndex: number;
  booksByFloor: Book[][];
  toggleRoom: (room: string, Icon: TablerIcon) => void;
  addCustomRoom: (name: string) => void;
  customRooms: string[];
  onNext: () => void;
}) {
  const selected = new Set((booksByFloor[floorIndex] ?? []).map((b) => b.room));
  const [draft, setDraft] = useState('');
  const railRef = useRef<HTMLDivElement>(null);
  const [railEnd, setRailEnd] = useState(false);
  const onRailScroll = useCallback(() => {
    const el = railRef.current;
    if (el) setRailEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);
  const submitCustom = () => {
    const name = draft.trim();
    if (!name) return;
    addCustomRoom(name);
    setDraft('');
  };
  return (
    <>
      {/* Three-row, horizontally scrollable chip rail with an end fade. */}
      <div className="relative -mx-5">
        <div
          ref={railRef}
          onScroll={onRailScroll}
          className="grid grid-rows-3 grid-flow-col auto-cols-max gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[...ROOMS, ...customRooms.map((name) => ({ name, Icon: IconDoor }))].map(({ name, Icon }) => {
            const isOn = selected.has(name);
            return (
              <Press
                key={name}
                onClick={() => toggleRoom(name, Icon)}
                className="flex items-center gap-2 p-2 pr-3 rounded-[12px]"
                style={{ background: isOn ? ACCENT : '#f3f3f3', color: isOn ? '#ffffff' : INK }}
              >
                {isOn ? <IconCheck size={22} /> : <Icon size={22} />}
                <span className="text-[14px] font-semibold tracking-[-0.28px] whitespace-nowrap">{name}</span>
              </Press>
            );
          })}
        </div>
        <div
          aria-hidden
          className={clsx(
            'absolute inset-y-0 right-0 w-14 pointer-events-none transition-opacity duration-200',
            railEnd ? 'opacity-0' : 'opacity-100',
          )}
          style={{ background: 'linear-gradient(to left, #ffffff, transparent)' }}
        />
      </div>
      {/* Add a custom room */}
      <div className="w-full bg-[#f3f3f3] rounded-full min-h-[60px] p-2 pl-5 flex items-center justify-between gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitCustom()}
          placeholder="Add a custom room"
          className="flex-1 min-w-0 bg-transparent outline-none text-[18px] font-semibold tracking-[-0.36px] placeholder:text-[#989898]"
          style={{ color: TEXT }}
        />
        {draft && (
          <Press
            aria-label="Clear"
            onClick={() => setDraft('')}
            className="size-[38px] rounded-full flex items-center justify-center shrink-0 bg-white"
          >
            <IconX size={17} color={TEXT_2} />
          </Press>
        )}
        <Press
          aria-label="Add custom room"
          onClick={submitCustom}
          className="size-[44px] rounded-full flex items-center justify-center shrink-0"
          style={{ background: draft.trim() ? ACCENT : '#ffffff', color: draft.trim() ? '#fff' : TEXT_2 }}
        >
          <IconPlus size={22} />
        </Press>
      </div>
      <CtaButton label="Continue" onClick={onNext} arrow />
    </>
  );
}

// ── Data sharing: postcards from your mailbox ───────────────────────────────
const ANALYTICS: { key: string; label: string; desc: string }[] = [
  { key: 'base', label: 'Basic analytics', desc: 'Installation type and version' },
  { key: 'usage', label: 'Usage', desc: 'Which integrations you use' },
  { key: 'stats', label: 'Statistics', desc: 'Counts of devices and automations' },
  { key: 'diag', label: 'Diagnostics', desc: 'Crash reports, to fix bugs sooner' },
];

function MailboxArt({ prefs }: { prefs: Record<string, boolean> }) {
  const allOn = ANALYTICS.every((a) => prefs[a.key]);
  // The thank-you letter rides along only when everything else is shared too.
  const cards: { key: string; special: boolean }[] = [
    ...ANALYTICS.filter((a) => prefs[a.key]).map((a) => ({ key: a.key, special: false })),
    ...(allOn && prefs.thanks ? [{ key: 'thanks', special: true }] : []),
  ];
  const anyOn = cards.length > 0;
  return (
    <div className="flex-1 flex items-end justify-center min-h-0 pb-4">
      <div className="flex flex-col items-center">
        <div className="relative w-[260px] h-[76px]">
          <AnimatePresence>
            {cards.map((c, i) => (
              <motion.div
                key={c.key}
                initial={{ y: 60, opacity: 0, rotate: 0 }}
                animate={{ y: 0, opacity: 1, rotate: (i - (cards.length - 1) / 2) * 7 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                className="absolute bottom-[-8px] w-[62px] h-[48px] rounded-[6px] shadow-[0_2px_6px_rgba(0,0,0,0.1)]"
                style={{
                  left: 99 + (i - (cards.length - 1) / 2) * 36,
                  transformOrigin: 'bottom center',
                  background: c.special ? ACCENT : '#ffffff',
                }}
              >
                {c.special ? (
                  <>
                    <IconHeart size={15} color="#ffffff" fill="#ffffff" className="absolute top-[5px] right-[5px]" />
                    <span className="absolute left-[7px] top-[9px] w-[24px] h-[3px] rounded-full bg-white/50" />
                    <span className="absolute left-[7px] top-[16px] w-[32px] h-[3px] rounded-full bg-white/50" />
                    <span className="absolute left-[7px] bottom-[6px] text-[9px] font-bold text-white leading-none">THX</span>
                  </>
                ) : (
                  <>
                    <span className="absolute top-[6px] right-[6px] size-[10px] rounded-[2px]" style={{ background: ACCENT }} />
                    <span className="absolute left-[7px] top-[9px] w-[24px] h-[3px] rounded-full bg-[#e6e6e6]" />
                    <span className="absolute left-[7px] top-[16px] w-[32px] h-[3px] rounded-full bg-[#e6e6e6]" />
                    <span className="absolute left-[7px] top-[23px] w-[20px] h-[3px] rounded-full bg-[#e6e6e6]" />
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {/* mailbox body with the slot and the flag */}
        <div className="relative z-10 w-[190px] h-[100px] bg-white rounded-[26px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center">
          <div className="w-[110px] h-[10px] rounded-full bg-[#e6e6e6]" />
          <div
            className="absolute -right-[24px] top-[44px] w-[38px] h-[9px] rounded-full transition-all duration-300"
            style={{
              background: anyOn ? ACCENT : '#e3e3e3',
              transformOrigin: 'left center',
              transform: anyOn ? 'rotate(-75deg)' : 'rotate(0deg)',
            }}
          />
        </div>
        {/* the post it stands on */}
        <div className="w-[14px] h-[44px] bg-white rounded-b-[7px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]" />
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
const DEVICE_POOL: { Icon: TablerIcon; name: string; value?: string; toggle?: boolean }[] = [
  { Icon: IconBulb, name: 'Ceiling light', toggle: true },
  { Icon: IconThermometer, name: 'Thermostat', value: '21,5°' },
  { Icon: IconPlug, name: 'Smart plug', toggle: true },
  { Icon: IconDroplet, name: 'Humidity', value: '52%' },
  { Icon: IconDeviceTv, name: 'TV', toggle: true },
  { Icon: IconLock, name: 'Front door', value: 'Locked' },
];

interface Card {
  id: string;
  name: string;
  Icon: TablerIcon;
  value?: string;
  toggle?: boolean;
  on: boolean;
}

function makeCard(i: number, idPrefix = 'card'): Card {
  const d = DEVICE_POOL[i % DEVICE_POOL.length];
  return { id: `${idPrefix}-${i}`, ...d, on: i % 3 !== 1 };
}

function MiniToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="w-[42px] h-[26px] rounded-full p-[3px] transition-colors duration-200"
      style={{ background: on ? ACCENT : '#e3e3e3' }}
    >
      <span
        className="block size-[20px] rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? 'translateX(16px)' : undefined }}
      />
    </button>
  );
}

function DashboardStep({
  homeName,
  initialCards,
  onBack,
}: {
  homeName: string;
  initialCards: Card[];
  onBack: () => void;
}) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [menuOpen, setMenuOpen] = useState(false);

  const addCard = () => setCards((prev) => [...prev, makeCard(prev.length, `card-${Date.now()}`)]);
  const flip = (id: string) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, on: !c.on } : c)));

  return (
    <>
      <div className="flex items-center justify-between w-full min-h-[44px] relative">
        <Press
          onClick={() => setMenuOpen((v) => !v)}
          className="min-h-[44px] px-4 rounded-full bg-[#f2f2f2] flex items-center gap-2"
        >
          <IconHome size={20} color="#707078" />
          <span className="text-[16px] font-semibold tracking-[-0.48px] max-w-[160px] truncate" style={{ color: '#707078' }}>
            {homeName.trim() || 'Home'}
          </span>
          <IconChevronDown
            size={18}
            color="#707078"
            style={{ transform: menuOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
          />
        </Press>
        <PopMenu open={menuOpen} onPick={() => setMenuOpen(false)} items={['Select a home', 'Edit home dashboard']} />
        <Press aria-label="Add to home" onClick={addCard} className="size-[44px] rounded-full flex items-center justify-center" style={{ background: ACCENT }}>
          <IconPlus size={22} color="white" />
        </Press>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pt-4">
        <div className="grid grid-cols-2 gap-2 content-start pb-4">
          <AnimatePresence>
            {cards.map((card) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className="relative bg-white rounded-[24px] p-2 flex flex-col gap-2"
              >
                {card.toggle && (
                  <span className="absolute top-[14px] right-[14px]">
                    <MiniToggle on={card.on} onToggle={() => flip(card.id)} />
                  </span>
                )}
                <div className="p-2 h-[54px] flex items-center">
                  <card.Icon size={24} color={card.toggle && !card.on ? TEXT_2 : TEXT} />
                </div>
                <div className="px-2 pb-2 flex flex-col">
                  <span className="text-[16px] font-semibold tracking-[-0.48px] truncate" style={{ color: TEXT }}>
                    {card.name}
                  </span>
                  <span className="text-[14px] font-semibold tracking-[-0.42px] truncate" style={{ color: TEXT_2 }}>
                    {card.toggle ? (card.on ? 'On' : 'Off') : card.value}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom nav — visual only for now, pinned to the bottom edge. */}
      <div className="w-full mt-auto rounded-full min-h-[68px] px-8 flex items-center justify-between" style={{ background: INK }}>
        <Press aria-label="Home" onClick={onBack} className="p-2 text-white">
          <IconHome size={26} />
        </Press>
        <Press aria-label="Search" className="p-2 text-[#8a8a8a]">
          <IconSearch size={26} />
        </Press>
        <Press aria-label="Activity" className="p-2 text-[#8a8a8a]">
          <IconClockHour4 size={26} />
        </Press>
        <Press aria-label="Profile" className="p-1">
          <span className="size-[30px] rounded-full bg-white flex items-center justify-center">
            <IconUser size={19} color={INK} />
          </span>
        </Press>
      </div>
    </>
  );
}

// ── Flow ─────────────────────────────────────────────────────────────────────
type Step =
  | 'welcome'
  | 'name'
  | 'users'
  | 'invite'
  | 'location'
  | 'floors'
  | 'areas'
  | 'permissions'
  | 'dashboard';
const ORDER: Step[] = ['welcome', 'name', 'users', 'invite', 'location', 'floors', 'areas', 'permissions', 'dashboard'];

export default function OnboardingV2Page() {
  const [step, setStep] = useState<Step>('welcome');
  const [homeName, setHomeName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invited, setInvited] = useState<string[]>([]);
  const [inviteDraft, setInviteDraft] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [mapActive, setMapActive] = useState(false);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [flag, setFlag] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [floors, setFloors] = useState(1);
  const [floorIndex, setFloorIndex] = useState(0);
  const [booksByFloor, setBooksByFloor] = useState<Book[][]>([[]]);
  const [customRooms, setCustomRooms] = useState<string[]>([]);
  const [nameFocused, setNameFocused] = useState(false);
  const [credFocused, setCredFocused] = useState(false);
  const [welcomeMenuOpen, setWelcomeMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  // On iOS the keyboard doesn't shrink a fixed layout — the browser pans the
  // page instead, shoving the artwork out of view. Sizing the column from the
  // visual viewport makes the layout genuinely shrink above the keyboard, and
  // `compact` swaps the artwork to keyboard-sized proportions.
  const [vvh, setVvh] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVvh(Math.round(vv.height));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  const compact = vvh !== null && vvh < 560;

  const showToast = (msg: string) => {
    const id = Date.now();
    setToast({ id, msg });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2800);
  };

  const addInvite = useCallback(
    (name: string) => setInvited((prev) => (prev.includes(name) ? prev : [...prev, name])),
    [],
  );

  const toggleRoom = useCallback(
    (room: string, Icon: TablerIcon) => {
      setBooksByFloor((prev) => {
        const next = prev.map((f) => [...f]);
        while (next.length < floors) next.push([]);
        const shelf = next[floorIndex];
        const at = shelf.findIndex((b) => b.room === room);
        if (at >= 0) shelf.splice(at, 1);
        else shelf.push(makeBook(room, Icon));
        return next;
      });
    },
    [floorIndex, floors],
  );

  const addCustomRoom = useCallback(
    (name: string) => {
      setCustomRooms((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setBooksByFloor((prev) => {
        const next = prev.map((f) => [...f]);
        while (next.length < floors) next.push([]);
        if (!next[floorIndex].some((b) => b.room === name)) next[floorIndex].push(makeBook(name, IconDoor));
        return next;
      });
    },
    [floorIndex, floors],
  );

  // +1 = forward, -1 = back; steers which side the artwork slides from.
  const [dir, setDir] = useState(1);

  const selectFloor = useCallback(
    (i: number) => {
      setDir(i > floorIndex ? 1 : -1);
      setFloorIndex(i);
    },
    [floorIndex],
  );

  // Micro-interaction: occasionally one standing book on the focused shelf
  // tips over — rare, and never once a third of the shelf is already leaning.
  useEffect(() => {
    if (step !== 'areas') return;
    const tick = setInterval(() => {
      setBooksByFloor((prev) => {
        const shelf = prev[floorIndex] ?? [];
        const standing = shelf.filter((b) => b.lean === 0);
        const leaning = shelf.length - standing.length;
        if (standing.length < 2 || leaning >= shelf.length / 3 || Math.random() < 0.65) return prev;
        const victim = standing[Math.floor(Math.random() * standing.length)];
        return prev.map((f, i) =>
          i === floorIndex
            ? f.map((b) => (b.id === victim.id ? { ...b, lean: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8) } : b))
            : f,
        );
      });
    }, 6000);
    return () => clearInterval(tick);
  }, [step, floorIndex]);

  // A beat after panning settles, the house raises the flag of the country
  // under the marker. Key-less reverse geocoding; failures just mean no flag.
  useEffect(() => {
    if (step !== 'location' || !location) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lng}&localityLanguage=en`,
        );
        const j = await r.json();
        const cc: string = j.countryCode || '';
        if (cc.length === 2) {
          setFlag(String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0))));
        }
      } catch {
        /* offline or blocked — no flag, no harm */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [step, location]);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(here);
        setLocation(here);
        setMapActive(true);
      },
      () => setLocating(false),
      { timeout: 10_000 },
    );
  };

  const submitInvite = () => {
    const name = inviteDraft.trim();
    if (!name) return;
    addInvite(name);
    setInviteDraft('');
    showToast(`Invite sent — ${name}'s key was added to the ring`);
  };

  // One example device per created area; six placeholders if none were made.
  const roomCount = booksByFloor.reduce((n, shelf) => n + shelf.length, 0);
  const cards: Card[] = Array.from({ length: roomCount || 6 }, (_, i) => makeCard(i, 'seed'));

  const next = () => {
    setDir(1);
    if (step === 'areas' && floorIndex < floors - 1) {
      setFloorIndex(floorIndex + 1);
      return;
    }
    if (step === 'floors') setFloorIndex(0);
    setStep(ORDER[ORDER.indexOf(step) + 1]);
  };
  const back = () => {
    setDir(-1);
    if (step === 'areas' && floorIndex > 0) {
      setFloorIndex(floorIndex - 1);
      return;
    }
    if (step === 'permissions') setFloorIndex(floors - 1);
    setStep(ORDER[ORDER.indexOf(step) - 1]);
  };

  const stepKey = step === 'areas' ? `areas-${floorIndex}` : step;

  const heading: { title: React.ReactNode; sub?: string } = (() => {
    switch (step) {
      case 'welcome':
        return { title: 'Welcome home', sub: 'A few easy questions, nothing is permanent' };
      case 'name':
        return { title: 'Name your home', sub: "It's written on the door. You can change it anytime." };
      case 'users':
        return { title: 'Your own key', sub: 'Your account unlocks this home — the password cuts your key.' };
      case 'invite':
        return { title: 'Invite your household', sub: 'Everyone gets their own key. You can also do this later.' };
      case 'location':
        return { title: 'Where is your home?', sub: 'Drag the map until your home sits under the marker.' };
      case 'floors':
        return { title: 'How many floors?', sub: 'Floors group your rooms which have your devices. Simple.' };
      case 'areas':
        return {
          title: (
            <>
              <span style={{ color: TEXT_2 }}>Areas on </span>
              <span>{floorName(floorIndex).toLowerCase()}</span>
            </>
          ),
          sub: 'Tap a shelf to hop between floors.',
        };
      case 'permissions':
        return { title: 'What leaves your home?', sub: 'Each one is an anonymous postcard to Home Assistant. All optional.' };
      default:
        return { title: '' };
    }
  })();

  const allAnalyticsOn = ANALYTICS.every((a) => prefs[a.key]);

  const art = (() => {
    switch (step) {
      case 'welcome':
        return <WelcomeArt homeName={homeName} userCount={1 + invited.length} />;
      case 'name':
        return (
          <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
            {/* Focusing the field leans in on the door so the name is the star. */}
            <div
              className="transition-transform duration-500 ease-out"
              style={{
                transform: nameFocused && !compact ? 'scale(1.32) translateY(12%)' : undefined,
                transformOrigin: 'top center',
              }}
            >
              <Door name={homeName} height={compact ? 190 : 310} swing={false} />
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
            {/* Focusing a credential turns the key horizontal, ready for its lock. */}
            <div
              className="transition-transform duration-500 ease-out"
              style={{ transform: credFocused ? `rotate(-90deg) scale(${compact ? 0.62 : 0.9})` : undefined }}
            >
              <Keychain
                keys={[{ id: 'admin', cutSeed: password || 'password', styleSeed: username || 'admin', color: INK }]}
                keyHeight={compact ? 76 : 110}
                ringSize={compact ? 50 : 72}
              />
            </div>
          </div>
        );
      case 'invite':
        return (
          <div className="flex-1 flex items-center justify-center min-h-0 relative overflow-hidden">
            <Keychain
              keys={[
                { id: 'admin', cutSeed: password || 'password', styleSeed: username || 'admin', color: INK },
                ...invited.map((name) => ({ id: `inv-${name}`, cutSeed: name, styleSeed: name, color: TEXT_2 })),
              ]}
              keyHeight={compact ? 76 : 110}
              ringSize={compact ? 50 : 72}
            />
            {/* while a name is being typed, their key drifts toward the ring */}
            <AnimatePresence>
              {inviteDraft.trim() && (
                <motion.div
                  key="ghost"
                  initial={{ x: 130, y: -80, rotate: 32, opacity: 0 }}
                  animate={{ x: 52, y: -18, rotate: 14, opacity: 0.6 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="absolute left-1/2 top-1/3 pointer-events-none"
                >
                  <KeySvg cutSeed={inviteDraft.trim()} styleSeed={inviteDraft.trim()} color={TEXT_DIM} height={compact ? 58 : 84} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      case 'location':
        return (
          <div className="flex-1 min-h-0 flex items-center justify-center py-2">
            {/* A landscape photo frame; focusing it develops the photo into a
                real, draggable map with the home badge fixed dead-centre. */}
            <div className="w-full max-w-[350px] bg-white rounded-[20px] p-2 pb-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col items-center gap-1">
              <div className="w-full h-[250px] rounded-[14px] overflow-hidden bg-[#edf3f5]">
                {mapActive ? (
                  <MapPicker center={center} onChange={setLocation} flag={flag} />
                ) : (
                  <Press onClick={() => setMapActive(true)} className="w-full h-full flex items-center justify-center">
                    <span style={{ animation: 'obv2-bob 2.4s ease-in-out infinite' }}>
                      <span
                        className="flex size-[44px] rounded-full items-center justify-center border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
                        style={{ background: ACCENT }}
                      >
                        <IconHome size={22} color="#ffffff" />
                      </span>
                    </span>
                  </Press>
                )}
              </div>
              <span className="text-[14px] font-semibold tracking-[-0.28px] py-1" style={{ color: TEXT_DIM }}>
                {mapActive ? 'Drag until your home sits under the marker' : 'Tap to place your home'}
              </span>
            </div>
          </div>
        );
      case 'floors':
        return (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
            <ShelfStack floors={floors} booksByFloor={[]} focusIndex={null} />
          </div>
        );
      case 'areas':
        return <AreasArt floors={floors} booksByFloor={booksByFloor} floorIndex={floorIndex} onSelectFloor={selectFloor} />;
      case 'permissions':
        return <MailboxArt prefs={prefs} />;
      default:
        return null;
    }
  })();

  const sheet = (() => {
    switch (step) {
      case 'welcome':
        return <CtaButton label="Let’s begin" onClick={next} />;
      case 'name':
        return (
          <>
            <PillInput
              value={homeName}
              onChange={setHomeName}
              placeholder="My Home"
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
            <CtaButton label="Continue" onClick={next} arrow disabled={!homeName.trim()} />
          </>
        );
      case 'users':
        return (
          <>
            <PillInput
              value={username}
              onChange={setUsername}
              placeholder="Username"
              onFocus={() => setCredFocused(true)}
              onBlur={() => setCredFocused(false)}
            />
            <PillInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
              secret
              onFocus={() => setCredFocused(true)}
              onBlur={() => setCredFocused(false)}
            />
            <CtaButton label="Continue" onClick={next} arrow disabled={!username.trim() || !password} />
          </>
        );
      case 'invite':
        return (
          <>
            <div className="w-full bg-[#f3f3f3] rounded-full min-h-[56px] p-2 pl-5 flex items-center justify-between gap-2">
              <input
                value={inviteDraft}
                onChange={(e) => setInviteDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitInvite()}
                placeholder="Invite someone by name"
                className="flex-1 min-w-0 bg-transparent outline-none text-[17px] font-semibold tracking-[-0.34px] placeholder:text-[#989898]"
                style={{ color: TEXT }}
              />
              {inviteDraft && (
                <Press
                  aria-label="Clear"
                  onClick={() => setInviteDraft('')}
                  className="size-[38px] rounded-full flex items-center justify-center shrink-0 bg-white"
                >
                  <IconX size={17} color={TEXT_2} />
                </Press>
              )}
              <Press
                aria-label="Send invite"
                onClick={submitInvite}
                className="size-[40px] rounded-full flex items-center justify-center shrink-0"
                style={{ background: inviteDraft.trim() ? ACCENT : '#ffffff', color: inviteDraft.trim() ? '#fff' : TEXT_2 }}
              >
                <IconUserPlus size={20} />
              </Press>
            </div>
            <CtaButton label="Continue" onClick={next} arrow disabled={invited.length === 0} />
            <Press onClick={next} className="mx-auto px-4 py-1 text-[15px] font-semibold tracking-[-0.3px]">
              <span style={{ color: TEXT_2 }}>Skip for now</span>
            </Press>
          </>
        );
      case 'location':
        return (
          <>
            <Press onClick={locateMe} className="w-full min-h-[52px] rounded-full bg-[#f3f3f3] flex items-center justify-center gap-2">
              <IconCurrentLocation size={20} color={TEXT_2} />
              <span className="text-[16px] font-semibold tracking-[-0.32px]" style={{ color: TEXT_2 }}>
                {locating ? 'Finding you…' : 'Use my location'}
              </span>
            </Press>
            <CtaButton label="Continue" onClick={next} arrow />
          </>
        );
      case 'floors':
        return (
          <>
            <AnimatePresence>
              {floors === MAX_FLOORS && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="text-center text-[14px] font-semibold tracking-[-0.28px]"
                  style={{ color: TEXT_2 }}
                >
                  🏰 That&apos;s not a house, that&apos;s a castle!
                </motion.p>
              )}
            </AnimatePresence>
            <div className="w-full bg-[#f3f3f3] rounded-full min-h-[64px] p-2 flex items-center justify-between">
              <Press
                aria-label="Fewer floors"
                onClick={() => setFloors(Math.max(1, floors - 1))}
                className={clsx(
                  'size-[48px] rounded-full flex items-center justify-center transition-opacity',
                  floors <= 1 && 'opacity-30 pointer-events-none',
                )}
                style={{ background: ACCENT }}
              >
                <IconMinus size={22} color="white" />
              </Press>
              <span className="text-[24px] font-semibold tracking-[-0.48px]" style={{ color: INK }}>
                {floors}
              </span>
              <Press
                aria-label="More floors"
                onClick={() => setFloors(Math.min(MAX_FLOORS, floors + 1))}
                className={clsx(
                  'size-[48px] rounded-full flex items-center justify-center transition-opacity',
                  floors >= MAX_FLOORS && 'opacity-30 pointer-events-none',
                )}
                style={{ background: ACCENT }}
              >
                <IconPlus size={22} color="white" />
              </Press>
            </div>
            <CtaButton label="Continue" onClick={next} arrow />
          </>
        );
      case 'areas':
        return (
          <AreasSheet
            floorIndex={floorIndex}
            booksByFloor={booksByFloor}
            toggleRoom={toggleRoom}
            addCustomRoom={addCustomRoom}
            customRooms={customRooms}
            onNext={next}
          />
        );
      case 'permissions':
        return (
          <>
            {ANALYTICS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <div className="flex flex-col min-w-0">
                  <span className="text-[16px] font-semibold tracking-[-0.32px]" style={{ color: TEXT }}>
                    {label}
                  </span>
                  <span className="text-[13px] tracking-[-0.26px]" style={{ color: TEXT_2 }}>
                    {desc}
                  </span>
                </div>
                <MiniToggle on={!!prefs[key]} onToggle={() => setPrefs({ ...prefs, [key]: !prefs[key] })} />
              </div>
            ))}
            {/* Sharing everything unlocks one more letter: a thank-you note. */}
            <AnimatePresence initial={false}>
              {allAnalyticsOn && (
                <motion.div
                  key="thanks"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[16px]" style={{ background: '#eef6f9' }}>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[16px] font-semibold tracking-[-0.32px]" style={{ color: TEXT }}>
                        Say thanks 💌
                      </span>
                      <span className="text-[13px] tracking-[-0.26px]" style={{ color: TEXT_2 }}>
                        Send a thank-you note to the Open Home Foundation
                      </span>
                    </div>
                    <MiniToggle on={!!prefs.thanks} onToggle={() => setPrefs({ ...prefs, thanks: !prefs.thanks })} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <CtaButton label="Finish" onClick={next} />
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <div
      className="fixed inset-0 overflow-hidden onboarding-v2"
      style={{ background: SURFACE, fontFamily: 'var(--font-onest), Onest, system-ui, sans-serif' }}
    >
      {/* The app smooths every radius into a squircle (globals.css data-squircle
          rule), which squares off this prototype's pill buttons. Figma uses true
          pill rounding here, so opt this subtree back out. The artwork's idle
          motion is CSS keyframes — framer's repeat animations stall under the
          step's AnimatePresence variants parent. */}
      <style>{`
        [data-squircle="on"] .onboarding-v2, [data-squircle="on"] .onboarding-v2 * { corner-shape: round; }
        @keyframes obv2-door { 0%, 70% { transform: rotateY(0deg); } 80%, 88% { transform: rotateY(-26deg); } 96%, 100% { transform: rotateY(0deg); } }
        @keyframes obv2-sway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @keyframes obv2-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes obv2-door-once { 0% { transform: rotateY(0deg); } 45% { transform: rotateY(-34deg); } 100% { transform: rotateY(0deg); } }
        @keyframes obv2-jingle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-11deg); } 55% { transform: rotate(8deg); } 80% { transform: rotate(-4deg); } }
        @keyframes obv2-pop { 0%, 100% { transform: scale(1); } 40% { transform: scale(1.14); } }
      `}</style>
      <div className="mx-auto max-w-[430px] relative" style={{ height: vvh ?? '100%' }}>
        {step === 'dashboard' ? (
          <div className="h-full flex flex-col gap-3 px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <DashboardStep homeName={homeName} initialCards={cards} onBack={back} />
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* static app bar — the step heading lives here */}
            <div className="px-5 pt-[calc(env(safe-area-inset-top)+12px)] relative z-20">
              <div className="relative flex items-center justify-between gap-2 min-h-[44px]">
                {step === 'welcome' ? (
                  <Press
                    onClick={() => setWelcomeMenuOpen((v) => !v)}
                    className="min-h-[44px] px-4 rounded-full bg-[#f3f3f3] flex items-center gap-1 shrink-0"
                  >
                    <span className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: TEXT_2 }}>
                      Custom
                    </span>
                    <IconChevronDown
                      size={17}
                      color={TEXT_2}
                      style={{ transform: welcomeMenuOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
                    />
                  </Press>
                ) : (
                  <Press
                    aria-label="Back"
                    onClick={back}
                    className="size-[44px] rounded-full bg-[#f3f3f3] flex items-center justify-center shrink-0"
                  >
                    <IconChevronLeft size={24} color={TEXT_2} />
                  </Press>
                )}
                <div className="flex-1 min-w-0 h-[44px] flex items-center justify-center overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.h1
                      key={stepKey}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18 }}
                      className="text-[19px] font-semibold tracking-[-0.38px] truncate max-w-full"
                      style={{ color: TEXT }}
                    >
                      {heading.title}
                    </motion.h1>
                  </AnimatePresence>
                </div>
                <Press
                  aria-label="Accessibility options"
                  className="size-[44px] rounded-full bg-[#f3f3f3] flex items-center justify-center shrink-0"
                >
                  <IconAccessible size={24} color={TEXT_2} />
                </Press>
                {step === 'welcome' && (
                  <PopMenu
                    open={welcomeMenuOpen}
                    onPick={() => setWelcomeMenuOpen(false)}
                    items={['Restore from a backup', 'Migrate from another system', 'Learn about Home Assistant']}
                  />
                )}
              </div>
              {/* supporting copy under the app bar — folded away when the
                  keyboard is up so the artwork keeps as much room as possible */}
              <div className={clsx('pt-1.5 flex items-start justify-center', compact ? 'hidden' : 'min-h-[40px]')}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={stepKey}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-[13.5px] text-center tracking-[-0.27px] max-w-[310px]"
                    style={{ color: TEXT_2 }}
                  >
                    {heading.sub ?? ''}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
            {/* toast — invite confirmations and the like */}
            <AnimatePresence>
              {toast && (
                <div className="absolute top-[calc(env(safe-area-inset-top)+62px)] inset-x-0 z-30 flex justify-center pointer-events-none">
                  <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    className="bg-white rounded-full px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.14)] text-[14px] font-semibold tracking-[-0.28px]"
                    style={{ color: TEXT }}
                  >
                    {toast.msg}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            {/* only the artwork slides between steps */}
            <div className="flex-1 min-h-0 relative px-5 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.div
                  key={stepKey}
                  custom={dir}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, x: 32 * d }),
                    center: { opacity: 1, x: 0 },
                    exit: (d: number) => ({ opacity: 0, x: -32 * d }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  className="h-full w-full flex flex-col"
                >
                  {art}
                </motion.div>
              </AnimatePresence>
            </div>
            {/* static bottom sheet — its contents crossfade per step */}
            <div className="bg-white rounded-t-[32px] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-10px_30px_rgba(0,0,0,0.06)]">
              <div className="mx-auto w-[40px] h-[4px] rounded-full bg-[#e6e6e6] mb-2" />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={stepKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex flex-col gap-2"
                >
                  {sheet}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
