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
    lean: Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8) : 0,
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
}: {
  label: string;
  books: Book[];
  dimmed: boolean;
  showHeadroom: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 28, scale: 0.92 }}
      animate={{ opacity: dimmed ? 0.4 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 28, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 340, damping: 26 }}
      className="w-full flex flex-col"
    >
      {(showHeadroom || books.length > 0) && (
        <div className="flex items-end justify-center gap-[3px] min-h-[100px] px-6">
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
}: {
  floors: number;
  booksByFloor: Book[][];
  /** null = no floor focused (floors step); otherwise dims the other shelves. */
  focusIndex: number | null;
}) {
  // Higher floors render first so the ground floor sits at the bottom.
  const order = Array.from({ length: floors }, (_, i) => floors - 1 - i);
  return (
    <div className="w-full h-full flex flex-col justify-end gap-3 pb-6">
      <AnimatePresence>
        {order.map((i) => (
          <Shelf
            key={FLOOR_NAMES[i]}
            label={FLOOR_NAMES[i]}
            books={booksByFloor[i] ?? []}
            dimmed={focusIndex !== null && i !== focusIndex}
            showHeadroom={focusIndex === i}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Shared chrome ────────────────────────────────────────────────────────────
function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center pt-2">
      <h1 className="text-[32px] font-semibold tracking-[-0.96px] leading-tight" style={{ color: TEXT }}>
        {children}
      </h1>
      {sub && (
        <p className="text-[16px] tracking-[-0.48px] max-w-[280px]" style={{ color: TEXT_2 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function HeaderBar({ onBack, left }: { onBack?: () => void; left?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between w-full min-h-[44px]">
      {onBack ? (
        <Press
          aria-label="Back"
          onClick={onBack}
          className="size-[44px] rounded-full bg-[#f3f3f3] flex items-center justify-center"
        >
          <IconChevronLeft size={24} color={TEXT_2} />
        </Press>
      ) : (
        (left ?? <span />)
      )}
      <Press aria-label="Accessibility options" className="size-[44px] rounded-full bg-[#f3f3f3] flex items-center justify-center">
        <IconAccessible size={24} color={TEXT_2} />
      </Press>
    </div>
  );
}

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

/** White bottom sheet separating each step's controls from the artwork. */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-5 mt-1 bg-white rounded-t-[32px] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-10px_30px_rgba(0,0,0,0.06)] flex flex-col gap-2">
      <div className="mx-auto w-[40px] h-[4px] rounded-full bg-[#e6e6e6] mb-1" />
      {children}
    </div>
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
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="w-full bg-[#f3f3f3] rounded-full min-h-[56px] px-5 flex items-center">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[17px] font-semibold tracking-[-0.34px] placeholder:text-[#989898]"
        style={{ color: TEXT }}
      />
    </div>
  );
}

// ── Keys & keychain: every person in the home holds a key ───────────────────
/** Stable 4-notch bitting derived from a string — the password cuts the key. */
function keyBits(seed: string): number[] {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: 4 }, (_, i) => ((h >> (i * 4)) & 15) / 15);
}

function KeySvg({ seed, color = INK, height = 88 }: { seed: string; color?: string; height?: number }) {
  const bits = keyBits(seed);
  // Modern flat blade: the bitting is valleys CUT INTO the right edge, not
  // teeth sticking out. Deeper password bits cut deeper dips.
  const L = 12;
  const R = 20;
  let blade = `M${L} 18 L${R} 18 `;
  bits.forEach((b, i) => {
    const y = 27 + i * 8;
    const depth = 3 + b * 5;
    blade += `L${R} ${y - 3} L${R - depth} ${y} L${R} ${y + 3} `;
  });
  blade += `L${R} 57 L16 62 L${L} 58 Z`;
  return (
    <svg width={height * 0.5} height={height} viewBox="0 0 32 64" fill="none">
      <circle cx="16" cy="10" r="7.5" stroke={color} strokeWidth="6" />
      <path d={blade} fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Keychain({
  keys,
  keyHeight = 88,
  ringSize = 60,
}: {
  keys: { id: string; seed: string; color: string }[];
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
              <KeySvg seed={k.seed} color={k.color} height={keyHeight} />
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── The door: the home itself, its name written on it ───────────────────────
function Door({ name, height = 345, swing = true }: { name?: string; height?: number; swing?: boolean }) {
  const width = Math.round(height * 0.504);
  return (
    <div className="relative" style={{ perspective: 700 }}>
      {/* The doorway — hidden behind the door until it swings open. */}
      <div className="absolute inset-[3px] rounded-[24px] bg-[#dcdcdc]" />
      <div
        className="relative rounded-[24px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
        style={{
          width,
          height,
          transformOrigin: 'left center',
          animation: swing ? 'obv2-door 9s ease-in-out infinite' : undefined,
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

// ── Steps ────────────────────────────────────────────────────────────────────
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
    seed: `home-${i}`,
    color: i === 0 ? INK : TEXT_2,
  }));
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0">
      {/* Figma composition: one centered column — the door with the shelf bar
          right below it. The flow's other objects hang on the wall around it:
          map frame and data switch left, keychain right. */}
      <div className="relative">
        <div
          className="absolute -left-[96px] top-[38px] bg-white rounded-[16px] p-2 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
          style={{ animation: 'obv2-sway 7s ease-in-out infinite' }}
        >
          <div className="w-[64px] h-[76px] rounded-[10px] bg-[#edf3f5] flex items-center justify-center">
            <span style={{ animation: 'obv2-bob 2.4s ease-in-out infinite' }}>
              <IconMapPin size={26} color={ACCENT} />
            </span>
          </div>
        </div>
        {/* the keychain — keys on a hook below the picture frame */}
        <div className="absolute -left-[86px] top-[162px]" style={{ animation: 'obv2-sway 8s ease-in-out infinite' }}>
          <Keychain keys={keys} keyHeight={54} ringSize={36} />
        </div>
        {/* the data-sharing switch — a doorbell beside the knob */}
        <div
          className="absolute -right-[62px] top-[172px] bg-white rounded-full p-2 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
          style={{ animation: 'obv2-sway 9s ease-in-out infinite' }}
        >
          <div className="w-[34px] h-[20px] rounded-full p-[2px]" style={{ background: ACCENT }}>
            <span className="block size-[16px] rounded-full bg-white translate-x-[14px]" />
          </div>
        </div>
        <Door name={homeName} />
        {/* The shelf bar below the door — a floor holding its area books */}
        <div className="relative mt-[19px]">
          <div className="absolute bottom-[30px] left-[16px] flex items-end gap-[3px]">
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
    </div>
  );
}

function WelcomeStep({
  homeName,
  userCount,
  onNext,
}: {
  homeName: string;
  userCount: number;
  onNext: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <div className="relative">
        <HeaderBar
          left={
            <Press
              onClick={() => setMenuOpen((v) => !v)}
              className="min-h-[44px] px-4 rounded-full bg-[#f3f3f3] flex items-center gap-1"
            >
              <span className="text-[16px] font-semibold tracking-[-0.32px]" style={{ color: TEXT_2 }}>
                Custom
              </span>
              <IconChevronDown
                size={18}
                color={TEXT_2}
                style={{ transform: menuOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
              />
            </Press>
          }
        />
        <PopMenu
          open={menuOpen}
          onPick={() => setMenuOpen(false)}
          items={['Restore from a backup', 'Migrate from another system', 'Learn about Home Assistant']}
        />
      </div>
      <Title sub="A few easy questions, nothing is permanent">Welcome home</Title>
      <WelcomeArt homeName={homeName} userCount={userCount} />
      <Sheet>
        <CtaButton label="Let’s begin" onClick={onNext} />
      </Sheet>
    </>
  );
}

// ── Name the home: what's written on the door ───────────────────────────────
function NameStep({
  homeName,
  setHomeName,
  onBack,
  onNext,
}: {
  homeName: string;
  setHomeName: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <HeaderBar onBack={onBack} />
      <Title sub="It's written on the door. You can change it anytime.">Name your home</Title>
      <div className="flex-1 flex items-center justify-center min-h-0">
        <Door name={homeName} height={300} swing={false} />
      </div>
      <Sheet>
        <PillInput value={homeName} onChange={setHomeName} placeholder="My Home" />
        <CtaButton label="Continue" onClick={onNext} arrow disabled={!homeName.trim()} />
      </Sheet>
    </>
  );
}

// ── Who holds the keys: the admin account + invited people ──────────────────
function UsersStep({
  username,
  setUsername,
  password,
  setPassword,
  invited,
  addInvite,
  onBack,
  onNext,
}: {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  invited: string[];
  addInvite: (name: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [inviteDraft, setInviteDraft] = useState('');
  // The admin's key is cut by their credentials — retype the password and the
  // notches change with it. Invited people get a key cut from their name.
  const keys = [
    { id: 'admin', seed: `${username}:${password}`, color: INK },
    ...invited.map((name) => ({ id: `inv-${name}`, seed: name, color: TEXT_2 })),
  ];
  const submitInvite = () => {
    const name = inviteDraft.trim();
    if (!name) return;
    addInvite(name);
    setInviteDraft('');
  };
  return (
    <>
      <HeaderBar onBack={onBack} />
      <Title sub="You're the first key. Invite the rest of the household anytime.">Who holds the keys?</Title>
      <div className="flex-1 flex items-center justify-center min-h-0">
        <Keychain keys={keys} keyHeight={110} ringSize={72} />
      </div>
      <Sheet>
        <PillInput value={username} onChange={setUsername} placeholder="Username" />
        <PillInput value={password} onChange={setPassword} type="password" placeholder="Password" />
        <div className="w-full bg-[#f3f3f3] rounded-full min-h-[56px] p-2 pl-5 flex items-center justify-between gap-3">
          <input
            value={inviteDraft}
            onChange={(e) => setInviteDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitInvite()}
            placeholder="Invite someone by name"
            className="flex-1 min-w-0 bg-transparent outline-none text-[17px] font-semibold tracking-[-0.34px] placeholder:text-[#989898]"
            style={{ color: TEXT }}
          />
          <Press
            aria-label="Invite person"
            onClick={submitInvite}
            className="size-[40px] rounded-full flex items-center justify-center shrink-0"
            style={{ background: inviteDraft.trim() ? ACCENT : '#ffffff', color: inviteDraft.trim() ? '#fff' : TEXT_2 }}
          >
            <IconUserPlus size={20} />
          </Press>
        </div>
        <CtaButton label="Continue" onClick={onNext} arrow disabled={!username.trim() || !password} />
      </Sheet>
    </>
  );
}

// ── Where the home sits: tap the framed pin, place it on a real map ─────────
function PlaceStep({
  location,
  setLocation,
  onBack,
  onNext,
}: {
  location: LatLng | null;
  setLocation: (l: LatLng) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [mapActive, setMapActive] = useState(!!location);
  // Centre handed to the map: only "use my location" sets it, so panning is
  // never yanked back under the finger.
  const [center, setCenter] = useState<LatLng | null>(location);
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
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

  return (
    <>
      <HeaderBar onBack={onBack} />
      <Title sub="Drag the map until the pin sits on your home.">Where is your home?</Title>
      <div className="flex-1 min-h-0 flex items-center justify-center py-2">
        {mapActive ? (
          <div className="w-full h-full max-h-[440px] rounded-[24px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <MapPicker center={center} onChange={setLocation} />
          </div>
        ) : (
          <Press
            onClick={() => setMapActive(true)}
            className="bg-white rounded-[20px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col items-center gap-3"
          >
            <div className="w-[160px] h-[190px] rounded-[14px] bg-[#edf3f5] flex items-center justify-center">
              <span style={{ animation: 'obv2-bob 2.4s ease-in-out infinite' }}>
                <IconMapPin size={44} color={ACCENT} />
              </span>
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.3px] pb-1" style={{ color: TEXT_2 }}>
              Tap to place your home
            </span>
          </Press>
        )}
      </div>
      <Sheet>
        <Press
          onClick={useMyLocation}
          className="w-full min-h-[52px] rounded-full bg-[#f3f3f3] flex items-center justify-center gap-2"
        >
          <IconCurrentLocation size={20} color={TEXT_2} />
          <span className="text-[16px] font-semibold tracking-[-0.32px]" style={{ color: TEXT_2 }}>
            {locating ? 'Finding you…' : 'Use my location'}
          </span>
        </Press>
        <CtaButton label="Continue" onClick={onNext} arrow />
      </Sheet>
    </>
  );
}

// ── Data sharing: Home Assistant's analytics toggles ────────────────────────
const ANALYTICS: { key: string; label: string; desc: string }[] = [
  { key: 'base', label: 'Basic analytics', desc: 'Installation type and version' },
  { key: 'usage', label: 'Usage', desc: 'Which integrations you use' },
  { key: 'stats', label: 'Statistics', desc: 'Counts of devices and automations' },
  { key: 'diag', label: 'Diagnostics', desc: 'Crash reports, to fix bugs sooner' },
];

function PermissionsStep({
  prefs,
  setPrefs,
  onBack,
  onNext,
}: {
  prefs: Record<string, boolean>;
  setPrefs: (p: Record<string, boolean>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const anyOn = Object.values(prefs).some(Boolean);
  return (
    <>
      <HeaderBar onBack={onBack} />
      <Title sub="Anonymous, optional, and off by default. Change it anytime.">Share data to help?</Title>
      <div className="flex-1 flex items-center justify-center min-h-0">
        {/* one big switch mirroring whether anything is shared */}
        <div className="bg-white rounded-full p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div
            className="w-[96px] h-[56px] rounded-full p-[6px] transition-colors duration-300"
            style={{ background: anyOn ? ACCENT : '#e3e3e3' }}
          >
            <span
              className="block size-[44px] rounded-full bg-white shadow-sm transition-transform duration-300"
              style={{ transform: anyOn ? 'translateX(40px)' : undefined }}
            />
          </div>
        </div>
      </div>
      <Sheet>
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
        <CtaButton label="Finish" onClick={onNext} />
      </Sheet>
    </>
  );
}

function FloorsStep({
  floors,
  setFloors,
  onBack,
  onNext,
}: {
  floors: number;
  setFloors: (n: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <HeaderBar onBack={onBack} />
      <Title sub="Floors group your rooms which have your devices. Simple.">How many floors?</Title>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
        <ShelfStack floors={floors} booksByFloor={[]} focusIndex={null} />
      </div>
      <Sheet>
        <div className="w-full bg-[#f3f3f3] rounded-full min-h-[64px] p-2 flex items-center justify-between">
          <Press
            aria-label="Fewer floors"
            onClick={() => setFloors(Math.max(1, floors - 1))}
            className="size-[48px] rounded-full flex items-center justify-center"
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
            className="size-[48px] rounded-full flex items-center justify-center"
            style={{ background: ACCENT }}
          >
            <IconPlus size={22} color="white" />
          </Press>
        </div>
        <CtaButton label="Continue" onClick={onNext} arrow />
      </Sheet>
    </>
  );
}

function AreasStep({
  floors,
  floorIndex,
  booksByFloor,
  toggleRoom,
  addCustomRoom,
  customRooms,
  onBack,
  onNext,
}: {
  floors: number;
  floorIndex: number;
  booksByFloor: Book[][];
  toggleRoom: (room: string, Icon: TablerIcon) => void;
  addCustomRoom: (name: string) => void;
  customRooms: string[];
  onBack: () => void;
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
      <HeaderBar onBack={onBack} />
      <Title>
        <span style={{ color: TEXT_2 }}>Areas on </span>
        <span>{FLOOR_NAMES[floorIndex].toLowerCase()}</span>
      </Title>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
        <ShelfStack floors={floors} booksByFloor={booksByFloor} focusIndex={floorIndex} />
      </div>
      <Sheet>
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
        <div className="w-full bg-[#f3f3f3] rounded-full min-h-[60px] p-2 pl-5 flex items-center justify-between gap-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitCustom()}
            placeholder="Add a custom room"
            className="flex-1 min-w-0 bg-transparent outline-none text-[18px] font-semibold tracking-[-0.36px] placeholder:text-[#989898]"
            style={{ color: TEXT }}
          />
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
      </Sheet>
    </>
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
type Step = 'welcome' | 'name' | 'users' | 'location' | 'floors' | 'areas' | 'permissions' | 'dashboard';
const ORDER: Step[] = ['welcome', 'name', 'users', 'location', 'floors', 'areas', 'permissions', 'dashboard'];

export default function OnboardingV2Page() {
  const [step, setStep] = useState<Step>('welcome');
  const [homeName, setHomeName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invited, setInvited] = useState<string[]>([]);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [floors, setFloors] = useState(1);
  const [floorIndex, setFloorIndex] = useState(0);
  const [booksByFloor, setBooksByFloor] = useState<Book[][]>([[]]);
  const [customRooms, setCustomRooms] = useState<string[]>([]);

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

  // Micro-interaction: every few seconds one standing book on the focused
  // shelf randomly tips over. Only while picking areas.
  useEffect(() => {
    if (step !== 'areas') return;
    const tick = setInterval(() => {
      setBooksByFloor((prev) => {
        const shelf = prev[floorIndex] ?? [];
        const standing = shelf.filter((b) => b.lean === 0);
        if (standing.length < 2 || Math.random() < 0.5) return prev;
        const victim = standing[Math.floor(Math.random() * standing.length)];
        return prev.map((f, i) =>
          i === floorIndex
            ? f.map((b) => (b.id === victim.id ? { ...b, lean: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8) } : b))
            : f,
        );
      });
    }, 3500);
    return () => clearInterval(tick);
  }, [step, floorIndex]);

  // One example device per created area; six placeholders if none were made.
  const roomCount = booksByFloor.reduce((n, shelf) => n + shelf.length, 0);
  const cards: Card[] = Array.from({ length: roomCount || 6 }, (_, i) => makeCard(i, 'seed'));

  // +1 = forward, -1 = back; steers which side steps slide in from and out to.
  const [dir, setDir] = useState(1);

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
      `}</style>
      <div className="mx-auto max-w-[430px] h-full">
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
            className={clsx(
              'h-full flex flex-col gap-3 px-5 pt-[calc(env(safe-area-inset-top)+12px)]',
              // Onboarding steps end in a full-bleed Sheet that carries its own
              // safe-area padding; only the dashboard needs the container's.
              step === 'dashboard' && 'pb-[calc(env(safe-area-inset-bottom)+16px)]',
            )}
          >
            {step === 'welcome' && (
              <WelcomeStep homeName={homeName} userCount={1 + invited.length} onNext={next} />
            )}
            {step === 'name' && (
              <NameStep homeName={homeName} setHomeName={setHomeName} onBack={back} onNext={next} />
            )}
            {step === 'users' && (
              <UsersStep
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
                invited={invited}
                addInvite={addInvite}
                onBack={back}
                onNext={next}
              />
            )}
            {step === 'location' && (
              <PlaceStep location={location} setLocation={setLocation} onBack={back} onNext={next} />
            )}
            {step === 'floors' && (
              <FloorsStep floors={floors} setFloors={setFloors} onBack={back} onNext={next} />
            )}
            {step === 'areas' && (
              <AreasStep
                floors={floors}
                floorIndex={floorIndex}
                booksByFloor={booksByFloor}
                toggleRoom={toggleRoom}
                addCustomRoom={addCustomRoom}
                customRooms={customRooms}
                onBack={back}
                onNext={next}
              />
            )}
            {step === 'permissions' && (
              <PermissionsStep prefs={prefs} setPrefs={setPrefs} onBack={back} onNext={next} />
            )}
            {step === 'dashboard' && (
              <DashboardStep homeName={homeName} initialCards={cards} onBack={back} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
