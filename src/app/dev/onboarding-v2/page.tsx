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

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
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
  IconDeviceMobile,
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
  IconBolt,
  IconChevronUp,
  IconChevronRight,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMap,
  IconUsers,
  IconTag,
  IconPuzzle,
  IconDevices,
  IconShape,
  IconTool,
  IconRobot,
  IconScript,
  IconSitemap,
  IconApps,
  IconMicrophone,
  IconSettings,
  IconNetwork,
  IconServer,
  IconFileText,
  IconCpu,
  IconRestore,
  IconBell,
  IconCloud,
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

const MAX_FLOORS = 5;

// ── Copy: EN/PL — the flag button on the welcome bar toggles ─────────────────
type Lang = 'en' | 'pl' | 'es';
interface Device {
  name: string;
  value?: string;
  toggle?: boolean;
}
interface Invitee {
  email: string;
  admin: boolean;
}

const ROOM_ICONS: TablerIcon[] = [
  IconSofa, IconToolsKitchen2, IconBed, IconBath, IconBriefcase, IconArmchair, IconDoor,
  IconHorseToy, IconWashMachine, IconCar, IconBarbell, IconPlant, IconStairs, IconLamp,
];
const DEVICE_ICONS: TablerIcon[] = [IconBulb, IconThermometer, IconPlug, IconDroplet, IconDeviceTv, IconLock];
const ANALYTIC_KEYS = ['base', 'usage', 'stats', 'diag'];
// Icons for L.dashboards (extra dashboards after the home one).
const DASH_ICONS: TablerIcon[] = [IconBolt, IconLock, IconPlant];
// Icons zipped against L.settings — same section/item shape.
const SETTINGS_ICONS: TablerIcon[][] = [
  [IconLayoutGrid, IconCloud, IconBell],
  [IconLayoutDashboard, IconMap, IconMapPin, IconUsers, IconTag],
  [IconPuzzle, IconDevices, IconShape, IconTool],
  [IconRobot, IconBulb, IconScript, IconSitemap],
  [IconApps],
  [IconMicrophone],
  [IconSettings, IconNetwork, IconServer, IconFileText, IconCpu, IconRestore],
];

const STR = {
  en: {
    code: 'EN',
    welcomeTitle: 'Welcome home',
    welcomeSub: 'A few easy questions, nothing is permanent',
    begin: 'Let’s begin',
    discoveredLine: (n: number) => (n === 1 ? '1 device found nearby' : `${n} devices found nearby`),
    cont: 'Continue',
    finish: 'Finish',
    skip: 'Skip for now',
    custom: 'Custom',
    customMenu: ['Restore from a backup', 'Migrate from another system', 'Learn about Home Assistant'],
    a11yMenu: ['Larger text', 'High contrast', 'Reduce motion', 'Spoken hints'],
    nameTitle: 'Name your home',
    namePh: 'Home name',
    nameChips: ['My Home', 'The Nest', 'Base Camp', 'The Cabin'],
    usersTitle: 'Create your account',
    userPh: 'Username',
    passPh: 'Password',
    inviteTitle: 'Invite others',
    inviteSub: 'Everyone gets their own key. You can also do this later.',
    invitePh: 'Email address',
    inviteHint: 'Everyone joins as a guest. You can make someone an admin later.',
    inviteSend: 'Invite',
    inviteToast: (email: string) => `Invite sent — a key is waiting for ${email}`,
    locTitle: 'Where is your home?',
    locSub: 'Search, or drag the map until your home sits under the marker.',
    locate: 'Use my location',
    locating: 'Finding you…',
    locSearchPh: 'Search for an address',
    tapPlace: 'Tap to place your home',
    dragHome: 'Drag until your home sits under the marker',
    floorsTitle: 'How many floors?',
    floorsSub: 'Floors group your rooms which have your devices. Simple.',
    quips: [
      'Cozy — everything within reach',
      'Two floors, a classic',
      'Three floors of morning cardio',
      'Your smartwatch will love these stairs',
      'That’s not a house, that’s a castle! 🏰',
    ],
    areasOn: 'Areas on ',
    areasSub: 'Tap a shelf to hop between floors.',
    nextFloor: 'Next floor',
    rotate: 'Rotate your phone',
    customRoomPh: 'Add a custom room',
    permTitle: 'What leaves your home?',
    permSub: 'Each one is an anonymous postcard to Home Assistant. All optional.',
    analytics: [
      { key: 'base', label: 'Basic analytics', desc: 'Installation type and version' },
      { key: 'usage', label: 'Usage', desc: 'Which integrations you use' },
      { key: 'stats', label: 'Statistics', desc: 'Counts of devices and automations' },
      { key: 'diag', label: 'Diagnostics', desc: 'Crash reports, to fix bugs sooner' },
    ],
    thanksTitle: 'Say thanks 💌',
    thanksDesc: 'Send a thank-you note to the Open Home Foundation',
    floors: ['Ground floor', 'First floor', 'Second floor', 'Third floor', 'Fourth floor'],
    tower: 'The tower 🏰',
    rooms: ['Living room', 'Kitchen', 'Bedroom', 'Bathroom', 'Office', 'Dining room', 'Hallway', 'Kids room', 'Laundry', 'Garage', 'Gym', 'Garden', 'Stairway', 'Studio'],
    devices: [
      { name: 'Ceiling light', toggle: true },
      { name: 'Thermostat', value: '21,5°' },
      { name: 'Smart plug', toggle: true },
      { name: 'Humidity', value: '52%' },
      { name: 'TV', toggle: true },
      { name: 'Front door', value: 'Locked' },
    ] as Device[],
    homeFallback: 'Home',
    dashMenu: ['Select a home', 'Edit home dashboard'],
    on: 'On',
    off: 'Off',
    searchPh: 'Search your home',
    noResults: 'Nothing found',
    actLine: (name: string, on: boolean) => `${name} ${on ? 'turned on' : 'turned off'}`,
    times: ['just now', '10 min ago', '1 h ago', '3 h ago', 'yesterday'],
    yourHome: 'Your home',
    people: 'People',
    admin: 'Admin',
    guest: 'Guest',
    dashboards: ['Energy', 'Security', 'Garden'],
    settingsTitle: 'Settings',
    settings: [
      { title: '', items: ['Home Center', 'Nabu Casa Cloud', 'Notifications'] },
      { title: 'My Home', items: ['Dashboards', 'Areas & Floors', 'Zones', 'Users', 'Tags'] },
      { title: 'Devices', items: ['Integrations', 'Devices & Services', 'Entities', 'Helpers'] },
      { title: 'Automation', items: ['Automations', 'Scenes', 'Scripts', 'Blueprints'] },
      { title: 'Applications', items: ['Applications'] },
      { title: 'Voice & AI', items: ['Voice Assistants'] },
      { title: 'System', items: ['General', 'Network', 'Storage', 'Logs', 'System Info', 'Backups'] },
    ],
  },
  pl: {
    code: 'PL',
    welcomeTitle: 'Witaj w domu',
    welcomeSub: 'Kilka prostych pytań, nic nie jest na zawsze',
    begin: 'Zaczynajmy',
    discoveredLine: (n: number) =>
      `Znaleziono ${n} ${n === 1 ? 'urządzenie' : n <= 4 ? 'urządzenia' : 'urządzeń'} w pobliżu`,
    cont: 'Dalej',
    finish: 'Zakończ',
    skip: 'Na razie pomiń',
    custom: 'Inne',
    customMenu: ['Przywróć z kopii zapasowej', 'Przenieś się z innego systemu', 'Poznaj Home Assistant'],
    a11yMenu: ['Większy tekst', 'Wysoki kontrast', 'Ogranicz animacje', 'Podpowiedzi głosowe'],
    nameTitle: 'Nazwij swój dom',
    namePh: 'Nazwa domu',
    nameChips: ['Mój dom', 'Gniazdko', 'Baza', 'Chatka'],
    usersTitle: 'Utwórz swoje konto',
    userPh: 'Nazwa użytkownika',
    passPh: 'Hasło',
    inviteTitle: 'Zaproś innych',
    inviteSub: 'Każdy dostaje własny klucz. Możesz to zrobić też później.',
    invitePh: 'Adres e-mail',
    inviteHint: 'Każdy dołącza jako gość. Później możesz zrobić kogoś administratorem.',
    inviteSend: 'Zaproś',
    inviteToast: (email: string) => `Zaproszenie wysłane — klucz czeka na ${email}`,
    locTitle: 'Gdzie jest twój dom?',
    locSub: 'Wyszukaj lub przesuwaj mapę, aż twój dom znajdzie się pod znacznikiem.',
    locate: 'Użyj mojej lokalizacji',
    locating: 'Szukam cię…',
    locSearchPh: 'Szukaj adresu',
    tapPlace: 'Dotknij, aby umieścić dom',
    dragHome: 'Przesuwaj, aż dom będzie pod znacznikiem',
    floorsTitle: 'Ile pięter?',
    floorsSub: 'Piętra grupują pokoje, a pokoje — twoje urządzenia. Proste.',
    quips: [
      'Przytulnie — wszystko pod ręką',
      'Dwa piętra, klasyka',
      'Trzy piętra porannego cardio',
      'Twój smartwatch pokocha te schody',
      'To nie dom, to zamek! 🏰',
    ],
    areasOn: 'Pokoje — ',
    areasSub: 'Dotknij półki, aby przeskoczyć między piętrami.',
    nextFloor: 'Następne piętro',
    rotate: 'Obróć telefon',
    customRoomPh: 'Dodaj własny pokój',
    permTitle: 'Co opuszcza twój dom?',
    permSub: 'Każda pozycja to anonimowa pocztówka do Home Assistant. Wszystko opcjonalne.',
    analytics: [
      { key: 'base', label: 'Podstawowe dane', desc: 'Typ instalacji i wersja' },
      { key: 'usage', label: 'Użycie', desc: 'Których integracji używasz' },
      { key: 'stats', label: 'Statystyki', desc: 'Liczba urządzeń i automatyzacji' },
      { key: 'diag', label: 'Diagnostyka', desc: 'Raporty o błędach, by naprawiać je szybciej' },
    ],
    thanksTitle: 'Podziękuj 💌',
    thanksDesc: 'Wyślij podziękowanie do Open Home Foundation',
    floors: ['Parter', 'Pierwsze piętro', 'Drugie piętro', 'Trzecie piętro', 'Czwarte piętro'],
    tower: 'Wieża 🏰',
    rooms: ['Salon', 'Kuchnia', 'Sypialnia', 'Łazienka', 'Biuro', 'Jadalnia', 'Przedpokój', 'Pokój dzieci', 'Pralnia', 'Garaż', 'Siłownia', 'Ogród', 'Schody', 'Pracownia'],
    devices: [
      { name: 'Lampa sufitowa', toggle: true },
      { name: 'Termostat', value: '21,5°' },
      { name: 'Inteligentna wtyczka', toggle: true },
      { name: 'Wilgotność', value: '52%' },
      { name: 'Telewizor', toggle: true },
      { name: 'Drzwi wejściowe', value: 'Zamknięte' },
    ] as Device[],
    homeFallback: 'Dom',
    dashMenu: ['Wybierz dom', 'Edytuj panel domu'],
    on: 'Wł.',
    off: 'Wył.',
    searchPh: 'Szukaj w domu',
    noResults: 'Nic nie znaleziono',
    actLine: (name: string, on: boolean) => `${on ? 'Włączono' : 'Wyłączono'}: ${name}`,
    times: ['przed chwilą', '10 min temu', '1 godz. temu', '3 godz. temu', 'wczoraj'],
    yourHome: 'Twój dom',
    people: 'Domownicy',
    admin: 'Administrator',
    guest: 'Gość',
    dashboards: ['Energia', 'Bezpieczeństwo', 'Ogród'],
    settingsTitle: 'Ustawienia',
    settings: [
      { title: '', items: ['Centrum domu', 'Nabu Casa Cloud', 'Powiadomienia'] },
      { title: 'Mój dom', items: ['Panele', 'Pomieszczenia i piętra', 'Strefy', 'Użytkownicy', 'Tagi'] },
      { title: 'Urządzenia', items: ['Integracje', 'Urządzenia i usługi', 'Elementy', 'Pomocnicy'] },
      { title: 'Automatyzacja', items: ['Automatyzacje', 'Sceny', 'Skrypty', 'Szablony'] },
      { title: 'Aplikacje', items: ['Aplikacje'] },
      { title: 'Głos i AI', items: ['Asystenci głosowi'] },
      { title: 'System', items: ['Ogólne', 'Sieć', 'Pamięć', 'Logi', 'Informacje o systemie', 'Kopie zapasowe'] },
    ],
  },
  es: {
    code: 'ES',
    welcomeTitle: 'Bienvenido a casa',
    welcomeSub: 'Unas preguntas fáciles, nada es permanente',
    begin: 'Empecemos',
    discoveredLine: (n: number) =>
      n === 1 ? '1 dispositivo encontrado cerca' : `${n} dispositivos encontrados cerca`,
    cont: 'Continuar',
    finish: 'Terminar',
    skip: 'Omitir por ahora',
    custom: 'Opciones',
    customMenu: ['Restaurar desde una copia', 'Migrar desde otro sistema', 'Conoce Home Assistant'],
    a11yMenu: ['Texto más grande', 'Alto contraste', 'Menos animaciones', 'Indicaciones de voz'],
    nameTitle: 'Nombra tu hogar',
    namePh: 'Nombre del hogar',
    nameChips: ['Mi casa', 'El nido', 'La base', 'La cabaña'],
    usersTitle: 'Crea tu cuenta',
    userPh: 'Nombre de usuario',
    passPh: 'Contraseña',
    inviteTitle: 'Invita a otros',
    inviteSub: 'Cada uno recibe su propia llave. También puedes hacerlo más tarde.',
    invitePh: 'Correo electrónico',
    inviteHint: 'Todos se unen como invitados. Luego puedes hacer a alguien administrador.',
    inviteSend: 'Invitar',
    inviteToast: (email: string) => `Invitación enviada — una llave espera a ${email}`,
    locTitle: '¿Dónde está tu hogar?',
    locSub: 'Busca o arrastra el mapa hasta que tu casa quede bajo el marcador.',
    locate: 'Usar mi ubicación',
    locating: 'Buscándote…',
    locSearchPh: 'Buscar una dirección',
    tapPlace: 'Toca para colocar tu casa',
    dragHome: 'Arrastra hasta que tu casa quede bajo el marcador',
    floorsTitle: '¿Cuántas plantas?',
    floorsSub: 'Las plantas agrupan tus habitaciones, que tienen tus dispositivos. Simple.',
    quips: [
      'Acogedor — todo a mano',
      'Dos plantas, un clásico',
      'Tres plantas de cardio matutino',
      'A tu smartwatch le encantarán estas escaleras',
      '¡Eso no es una casa, es un castillo! 🏰',
    ],
    areasOn: 'Habitaciones — ',
    areasSub: 'Toca una balda para saltar entre plantas.',
    nextFloor: 'Siguiente planta',
    rotate: 'Gira tu teléfono',
    customRoomPh: 'Añade una habitación',
    permTitle: '¿Qué sale de tu casa?',
    permSub: 'Cada una es una postal anónima a Home Assistant. Todo opcional.',
    analytics: [
      { key: 'base', label: 'Datos básicos', desc: 'Tipo de instalación y versión' },
      { key: 'usage', label: 'Uso', desc: 'Qué integraciones usas' },
      { key: 'stats', label: 'Estadísticas', desc: 'Número de dispositivos y automatizaciones' },
      { key: 'diag', label: 'Diagnóstico', desc: 'Informes de errores, para corregirlos antes' },
    ],
    thanksTitle: 'Da las gracias 💌',
    thanksDesc: 'Envía un agradecimiento a la Open Home Foundation',
    floors: ['Planta baja', 'Primera planta', 'Segunda planta', 'Tercera planta', 'Cuarta planta'],
    tower: 'La torre 🏰',
    rooms: ['Salón', 'Cocina', 'Dormitorio', 'Baño', 'Oficina', 'Comedor', 'Pasillo', 'Cuarto de niños', 'Lavadero', 'Garaje', 'Gimnasio', 'Jardín', 'Escalera', 'Estudio'],
    devices: [
      { name: 'Lámpara de techo', toggle: true },
      { name: 'Termostato', value: '21,5°' },
      { name: 'Enchufe inteligente', toggle: true },
      { name: 'Humedad', value: '52%' },
      { name: 'Televisor', toggle: true },
      { name: 'Puerta principal', value: 'Cerrada' },
    ] as Device[],
    homeFallback: 'Casa',
    dashMenu: ['Elegir un hogar', 'Editar el panel'],
    on: 'Enc.',
    off: 'Apag.',
    searchPh: 'Buscar en casa',
    noResults: 'Sin resultados',
    actLine: (name: string, on: boolean) => `${on ? 'Encendido' : 'Apagado'}: ${name}`,
    times: ['ahora mismo', 'hace 10 min', 'hace 1 h', 'hace 3 h', 'ayer'],
    yourHome: 'Tu hogar',
    people: 'Personas',
    admin: 'Administrador',
    guest: 'Invitado',
    dashboards: ['Energía', 'Seguridad', 'Jardín'],
    settingsTitle: 'Ajustes',
    settings: [
      { title: '', items: ['Centro del hogar', 'Nabu Casa Cloud', 'Notificaciones'] },
      { title: 'Mi hogar', items: ['Paneles', 'Habitaciones y plantas', 'Zonas', 'Usuarios', 'Etiquetas'] },
      { title: 'Dispositivos', items: ['Integraciones', 'Dispositivos y servicios', 'Entidades', 'Auxiliares'] },
      { title: 'Automatización', items: ['Automatizaciones', 'Escenas', 'Scripts', 'Planos'] },
      { title: 'Aplicaciones', items: ['Aplicaciones'] },
      { title: 'Voz e IA', items: ['Asistentes de voz'] },
      { title: 'Sistema', items: ['General', 'Red', 'Almacenamiento', 'Registros', 'Información del sistema', 'Copias de seguridad'] },
    ],
  },
};
type Copy = typeof STR.en;
const LANGS: Lang[] = ['en', 'pl', 'es'];
const LANG_NAMES: Record<Lang, string> = { en: 'English', pl: 'Polski', es: 'Español' };
const LANG_FLAGS: Record<Lang, string> = { en: '🇬🇧', pl: '🇵🇱', es: '🇪🇸' };

// Easter egg: whoever builds to the top of the stepper gets a tower.
const floorName = (L: Copy, i: number) => (i === MAX_FLOORS - 1 ? L.tower : L.floors[i]);

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

// Soft spine colors — light enough that the gray room icon reads on all of them.
const BOOK_TONES = ['#ffffff', '#f6e8c9', '#cfe6f2', '#d9ead3', '#f4dcd6', '#e6e0f2', '#ffffff'];

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
  onStraighten,
}: {
  label: string;
  books: Book[];
  dimmed: boolean;
  showHeadroom: boolean;
  index?: number;
  onSelect?: () => void;
  /** Tapping a leaning book stands it back up. */
  onStraighten?: (id: string) => void;
}) {
  // Touching a standing book gives it a little wobble around its lean.
  const [pokedId, setPokedId] = useState<string | null>(null);
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
                  initial={{ y: -150, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 17, mass: 0.9 }}
                  className="shrink-0"
                  style={{ width: book.w, height: book.h }}
                >
                  {/* The lean lives here as plain CSS so the poke wobble can
                      key off it (the keyframes read var(--lean)). */}
                  <div
                    title={book.room}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      // A tipped book gets tidied upright; a standing one wobbles.
                      if (book.lean !== 0) onStraighten?.(book.id);
                      else setPokedId(book.id);
                    }}
                    onAnimationEnd={() => setPokedId((p) => (p === book.id ? null : p))}
                    className="w-full h-full rounded-[6px] shadow-[0_2px_4px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col items-center pt-[7px] transition-transform duration-500"
                    style={
                      {
                        background: book.tone,
                        transformOrigin: book.lean < 0 ? 'bottom left' : 'bottom right',
                        transform: `rotate(${book.lean}deg)`,
                        '--lean': `${book.lean}deg`,
                        animation: pokedId === book.id ? 'obv2-book-poke 0.65s ease' : undefined,
                      } as React.CSSProperties
                    }
                  >
                    <book.Icon size={18} color={TEXT_2} stroke={1.75} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      {/* the shelf plank — wood-rounded, not a pill */}
      <motion.div layout className="w-full bg-white rounded-[12px] min-h-[44px] flex items-center justify-center px-4">
        <span className="text-[20px] font-semibold tracking-[-0.4px]" style={{ color: TEXT_DIM }}>
          {label}
        </span>
      </motion.div>
    </motion.div>
  );
}

function ShelfStack({
  L,
  floors,
  booksByFloor,
  focusIndex,
  onSelect,
  onStraighten,
}: {
  L: Copy;
  floors: number;
  booksByFloor: Book[][];
  /** null = no floor focused (floors step); otherwise dims the other shelves. */
  focusIndex: number | null;
  /** When set, tapping a shelf jumps to that floor. */
  onSelect?: (i: number) => void;
  onStraighten?: (id: string) => void;
}) {
  // Higher floors render first so the ground floor sits at the bottom.
  const order = Array.from({ length: floors }, (_, i) => floors - 1 - i);
  return (
    // Phones ground the stack at the bottom; the lg split centres it.
    <div className="w-full max-w-[560px] md:max-w-[720px] lg:max-w-[54%] mx-auto min-h-full flex flex-col justify-end lg:justify-center gap-3 pb-12 lg:pb-0">
      <AnimatePresence>
        {order.map((i) => (
          <Shelf
            key={`floor-${i}`}
            label={floorName(L, i)}
            books={booksByFloor[i] ?? []}
            dimmed={focusIndex !== null && i !== focusIndex}
            showHeadroom={focusIndex === i}
            index={i}
            onSelect={onSelect && i !== focusIndex ? () => onSelect(i) : undefined}
            onStraighten={onStraighten}
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
  onPickItem,
  leading,
  align = 'left',
}: {
  open: boolean;
  items: string[];
  onPick: () => void;
  /** Optional per-item hook, called with the item index before onPick. */
  onPickItem?: (i: number) => void;
  /** Optional per-item leading adornment (e.g. a flag emoji). */
  leading?: string[];
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
          {items.map((label, i) => (
            <Press
              key={label}
              onClick={() => {
                onPickItem?.(i);
                onPick();
              }}
              className="text-left px-4 py-3 rounded-[14px] text-[15px] font-semibold tracking-[-0.3px] hover:bg-[#f3f3f3] flex items-center gap-2.5"
              style={{ color: TEXT }}
            >
              {leading?.[i] && <span className="text-[17px] leading-none">{leading[i]}</span>}
              <span>{label}</span>
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
        'obv2-cta w-full min-h-[52px] rounded-full flex items-center justify-between px-3 text-white transition-opacity',
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
  delayFocus = false,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Password-style field with a show/hide eye. */
  secret?: boolean;
  /**
   * Choreograph the tap: fire onFocus (the artwork zoom) immediately but hold
   * the actual focus — and with it the keyboard — until the zoom has landed.
   */
  delayFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="w-full bg-[#f3f3f3] rounded-full min-h-[56px] pl-5 pr-2 flex items-center gap-1">
      <input
        // Always type="text": iOS hangs its password-manager UI (save/use
        // existing password) off type="password", which this prototype never
        // wants. The dots come from -webkit-text-security instead.
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize={secret ? 'off' : undefined}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => {
          if (!delayFocus) return;
          const el = e.currentTarget;
          if (document.activeElement === el) return;
          // Hopping between two inputs keeps the keyboard up — delaying the
          // focus there just makes the UI stutter. Only choreograph the
          // keyboard-raising first focus.
          if (document.activeElement?.tagName === 'INPUT') return;
          e.preventDefault();
          onFocus?.();
          setTimeout(() => el.focus(), 360);
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[17px] font-semibold tracking-[-0.34px] placeholder:text-[#989898]"
        style={{ color: TEXT, WebkitTextSecurity: secret && !show ? 'disc' : undefined } as React.CSSProperties}
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
/** Plastic key-cap colors — picked by the person's style seed. */
const KEY_CAPS = ['#009ac7', '#e8a33d', '#7bb662', '#d96c6c', '#8e7cc3', '#e58f65'];

/** Stable hash used to cut and shape keys. */
function keyHash(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** The cap color a person's key wears — reused wherever they're represented. */
const capColorFor = (seed: string) => KEY_CAPS[keyHash(seed) % KEY_CAPS.length];

function KeySvg({
  cutSeed,
  styleSeed,
  color = INK,
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
          fill={color}
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
      <path d={blade} fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {kind === 1 &&
        // The password drills the dimples: position and depth per bit, spread
        // wide enough that a new password visibly re-cuts the pattern.
        bits.map((b, i) => (
          <circle key={i} cx={mid + (b - 0.5) * 5} cy={28 + i * 8} r={1.2 + b * 1.4} fill={SURFACE} />
        ))}
      {/* thin body-coloured collar, then the cap on top of everything */}
      <rect x="12" y={15.5} width="8" height="4" rx="2" fill={color} />
      <circle cx="16" cy="10" r={headR} stroke={cap} strokeWidth={headStroke} />
    </svg>
  );
}

function Keychain({
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
    <div className="flex flex-col items-center">
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
    </div>
  );
}

// ── The door: the home itself, its name written on it ───────────────────────
function Door({
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
            style={{ color: TEXT_2, top: Math.round(height * 0.19), fontSize: Math.max(12, Math.round(width * 0.105)), letterSpacing: '-0.02em' }}
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
 * the home name, set up first), the key is your account, the framed pin is the
 * location map, and the books on the shelf are areas on a floor. The heading
 * lives here, display-sized — every other step keeps it in the app bar.
 */
function WelcomeArt({ homeName, L }: { homeName: string; L: Copy }) {
  // Tap micro-interactions: one-shot animations that hand back to the idle
  // sway when they finish.
  const [poke, setPoke] = useState<string | null>(null);
  const endPoke = () => setPoke(null);
  // The shelf books wobble individually, same as the area books later on.
  const [pokedBook, setPokedBook] = useState<number | null>(null);
  // Easter egg: knock 20 times and someone finally answers — the house cat
  // saunters out while the door stands open, then it swings shut again.
  const doorTaps = useRef(0);
  const [catOut, setCatOut] = useState(false);
  // …and 20 knocks after the cat, the door just gives up: it swings open onto
  // the hallway and stays that way until the next tap shuts it.
  const [gaveUp, setGaveUp] = useState(false);
  const knock = () => {
    if (catOut) return;
    if (gaveUp) {
      setGaveUp(false);
      return;
    }
    doorTaps.current += 1;
    const n = doorTaps.current % 40;
    if (n === 20) setCatOut(true);
    else if (n === 0) setGaveUp(true);
    else setPoke('door');
  };
  return (
    <div className="flex-1 min-h-0 w-full flex flex-col">
      <div className="text-center pt-7 pb-2 md:pt-3 lg:hidden">
        <h1 className="text-[32px] md:text-[42px] font-semibold tracking-[-0.96px] md:tracking-[-1.26px] leading-tight" style={{ color: TEXT }}>
          {L.welcomeTitle}
        </h1>
        <p className="text-[16px] md:text-[18px] tracking-[-0.48px] md:tracking-[-0.36px] mt-1 md:mt-2 mx-auto max-w-[280px] md:max-w-[480px]" style={{ color: TEXT_2 }}>
          {L.welcomeSub}
        </p>
      </div>
      {/* the scene is composed at phone width — on wider screens it just
          stands centred instead of stretching apart */}
      {/* not scaled: the scene's door is already display-sized, and growth
          would collide with the heading above it */}
      <div className="obv2-art obv2-welcome flex-1 min-h-0 relative w-full max-w-[430px] mx-auto">
        {/* the door bleeds off the left edge, standing on its mat */}
        {/* lg: the door stands centred in the house */}
        <div
          className="absolute -left-[52px] top-1/2 -translate-y-1/2 cursor-pointer lg:left-1/2 lg:-translate-x-1/2"
          onClick={knock}
        >
          <motion.div layoutId="obv2-door">
            <Door name={homeName} height={330} poked={poke === 'door'} held={catOut} open={gaveUp} onPokeEnd={endPoke} />
          </motion.div>
          {/* the doormat — a flat slab at the doorstep, skewed away from the door */}
          <div
            className="mt-[18px] ml-[8px] w-[168px] h-[34px] bg-white rounded-[12px]"
            style={{ transform: 'skewX(32deg)' }}
          />
          {/* the map in a landscape photo frame, hung beside the doorframe from
              a wire on a nail — a tap swings the whole thing around it. Right
              of the door on phones (the door bleeds off the left edge there),
              left of it on lg where the door stands centred */}
          <div
            className="absolute left-[calc(100%+22px)] top-[4px] flex flex-col items-center cursor-pointer lg:left-auto lg:right-[calc(100%+44px)]"
            onClick={(e) => {
              e.stopPropagation();
              setPoke('frame');
            }}
            onAnimationEnd={poke === 'frame' ? endPoke : undefined}
            style={{
              transformOrigin: 'top center',
              animation: poke === 'frame' ? 'obv2-hang-swing 1.1s ease-in-out' : 'obv2-sway 7s ease-in-out infinite',
            }}
          >
            <svg aria-hidden width="64" height="22" viewBox="0 0 64 22" fill="none" className="-mb-[4px]">
              <path d="M4 22 L32 4 L60 22" stroke="#d2d2d2" strokeWidth="2" strokeLinecap="round" />
              <circle cx="32" cy="3.5" r="2.5" fill="#c4c4c4" />
            </svg>
            <div className="bg-white rounded-[16px] p-2 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
              <div className="w-[104px] h-[70px] rounded-[10px] bg-[#edf3f5] flex items-center justify-center">
                <span style={{ animation: 'obv2-bob 2.4s ease-in-out infinite' }}>
                  <IconMapPin size={26} color={ACCENT} />
                </span>
              </div>
            </div>
          </div>
          {/* a little entryway cabinet under the picture (lg only — on phones
              that wall spot doesn't exist) */}
          <div aria-hidden className="hidden lg:flex absolute right-[calc(100%+58px)] bottom-0 flex-col">
            <div className="relative w-[96px] h-[44px] bg-white rounded-[10px] shadow-[0_2px_5px_rgba(0,0,0,0.06)]">
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[14px] h-[4px] rounded-full bg-[#e6e6e6]" />
            </div>
            <div className="flex justify-between px-[10px]">
              <span className="w-[8px] h-[10px] bg-white rounded-b-[4px]" />
              <span className="w-[8px] h-[10px] bg-white rounded-b-[4px]" />
            </div>
          </div>
        </div>
        {/* the answerer: walks out of the held-open door, bottom on the floor
            line, and keeps going until it leaves the scene (and the screen) */}
        {catOut && (
          <div
            aria-hidden
            className="absolute left-[20px] top-1/2 pointer-events-none z-10 lg:left-[calc(50%-16px)]"
            style={{ marginTop: 161, animation: 'obv2-cat-walk 4.4s ease-in 0.7s both' }}
            onAnimationEnd={() => setCatOut(false)}
          >
            <div className="relative w-[52px] h-[30px]" style={{ animation: 'obv2-bob 0.5s ease-in-out infinite' }}>
              <span
                className="absolute -left-[10px] bottom-[9px] w-[16px] h-[5px] bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                style={{ transformOrigin: 'right center', animation: 'obv2-cat-tail 0.9s ease-in-out infinite' }}
              />
              <span className="absolute left-0 bottom-0 w-[44px] h-[20px] bg-white rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.08)]" />
              <span className="absolute right-[13px] bottom-[23px] size-[7px] bg-white rounded-[2px] rotate-45" />
              <span className="absolute right-[3px] bottom-[23px] size-[7px] bg-white rounded-[2px] rotate-45" />
              <span className="absolute right-0 bottom-[9px] size-[18px] bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.06)]" />
              <span className="absolute right-[3px] bottom-[9px] size-[4px] rounded-full" style={{ background: ACCENT }} />
            </div>
          </div>
        )}
        {/* a robot vacuum makes the occasional cleaning pass at doormat level —
            drawn in profile like the rest of the scene: a low puck with its
            lidar turret up top */}
        {/* lg: shifted left so its sweep covers the floor by the cabinet, never
            the doormat under the centred door — and it visits far less often */}
        <div
          aria-hidden
          className="obv2-vac absolute left-[200px] top-1/2 pointer-events-none lg:-left-[60px]"
          style={{ marginTop: 159 }}
        >
          <div className="relative w-[116px] h-[32px] bg-white rounded-[10px] shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
            <span className="absolute -top-[12px] left-1/2 -translate-x-1/2 w-[32px] h-[13px] bg-white rounded-t-[6px]" />
            <span className="absolute top-[12px] right-[13px] size-[8px] rounded-full" style={{ background: ACCENT }} />
          </div>
        </div>
        {/* the wall arrangement on the right — both shelves share a left edge;
            on lg it steps beside the centred door */}
        <div className="absolute left-[158px] top-[calc(50%+56px)] -translate-y-1/2 flex flex-col gap-7 items-start lg:left-[calc(50%+124px)] lg:top-[calc(50%-8px)]">
          <div className="flex items-end gap-4">
            {/* the Home Assistant ZBT-2 — antenna up, chatting with the devices */}
            <div className="relative flex flex-col items-start">
              <div className="w-[54px] flex flex-col items-center">
                {[0, 1].map((i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="absolute -top-[16px] left-[27px] size-[40px] rounded-full border-2 border-white"
                    style={{ marginLeft: -20, animation: `obv2-pulse 2.6s ease-out ${i * 1.3}s infinite` }}
                  />
                ))}
                <div className="relative w-[10px] h-[42px] bg-white rounded-t-full" />
                <div className="relative w-[26px] h-[8px] bg-white rounded-full" />
              </div>
              {/* a small potted plant keeps the ZBT company on its shelf */}
              <div aria-hidden className="absolute right-[16px] bottom-[30px] flex flex-col items-center">
                <div className="flex items-end -mb-[3px]">
                  <span className="w-[10px] h-[22px] bg-white rounded-full -rotate-[24deg] translate-x-[4px]" />
                  <span className="w-[10px] h-[27px] bg-white rounded-full" />
                  <span className="w-[10px] h-[19px] bg-white rounded-full rotate-[24deg] -translate-x-[4px]" />
                </div>
                <div className="w-[26px] h-[16px] bg-white rounded-b-[8px] rounded-t-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]" />
              </div>
              <div className="relative mt-[6px] w-[170px] h-[30px] bg-white rounded-[10px]" />
            </div>
          </div>
          {/* your key and the area books, standing together on a shelf */}
          <div className="flex flex-col">
            <div className="flex items-end gap-5 pl-3">
              <div
                className="cursor-pointer drop-shadow-[0_2px_3px_rgba(0,0,0,0.08)]"
                onClick={() => setPoke('keys')}
                onAnimationEnd={poke === 'keys' ? endPoke : undefined}
                style={{
                  // The ring is the pivot — a poke jingles the whole bunch
                  // around it, same as the account step's keychain.
                  transformOrigin: 'top center',
                  animation: poke === 'keys' ? 'obv2-jingle 0.8s ease' : undefined,
                }}
              >
                <div className="w-[36px]">
                  <Keychain keys={[{ id: 'home', cutSeed: 'home', styleSeed: 'home', color: '#ffffff' }]} keyHeight={54} ringSize={30} />
                </div>
              </div>
              <div className="flex items-end gap-[5px]">
                {[
                  { w: 18, h: 66, lean: 0 },
                  { w: 21, h: 74, lean: 0 },
                  { w: 16, h: 56, lean: 8 },
                ].map((b, i) => (
                  <div
                    key={i}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setPokedBook(i);
                    }}
                    onAnimationEnd={() => setPokedBook((p) => (p === i ? null : p))}
                    className="bg-white rounded-[6px] shadow-[0_2px_4px_rgba(0,0,0,0.06)] cursor-pointer"
                    style={
                      {
                        width: b.w,
                        height: b.h,
                        transform: b.lean ? `rotate(${b.lean}deg)` : undefined,
                        transformOrigin: 'bottom right',
                        '--lean': `${b.lean}deg`,
                        animation: pokedBook === i ? 'obv2-book-poke 0.65s ease' : undefined,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            </div>
            <div className="mt-[8px] w-[170px] h-[30px] bg-white rounded-[10px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Areas: the scrollable shelf stack (art) and the chip rail (sheet) ───────
function AreasArt({
  L,
  floors,
  booksByFloor,
  floorIndex,
  onSelectFloor,
  onStraighten,
}: {
  L: Copy;
  floors: number;
  booksByFloor: Book[][];
  floorIndex: number;
  onSelectFloor: (i: number) => void;
  onStraighten: (id: string) => void;
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
        <ShelfStack L={L} floors={floors} booksByFloor={booksByFloor} focusIndex={floorIndex} onSelect={onSelectFloor} onStraighten={onStraighten} />
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
  L,
  floorIndex,
  booksByFloor,
  toggleRoom,
  addCustomRoom,
  customRooms,
  ctaLabel,
  onNext,
}: {
  L: Copy;
  floorIndex: number;
  booksByFloor: Book[][];
  toggleRoom: (room: string, Icon: TablerIcon) => void;
  addCustomRoom: (name: string) => void;
  customRooms: string[];
  /** "Next floor" while floors remain, "Continue" on the last one. */
  ctaLabel: string;
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
          {[
            ...L.rooms.map((name, i) => ({ name, Icon: ROOM_ICONS[i] })),
            ...customRooms.map((name) => ({ name, Icon: IconDoor })),
          ].map(({ name, Icon }) => {
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
          placeholder={L.customRoomPh}
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
      <CtaButton label={ctaLabel} onClick={onNext} arrow />
    </>
  );
}

// ── Data sharing: postcards from your mailbox ───────────────────────────────
function MailboxArt({ prefs }: { prefs: Record<string, boolean> }) {
  const allOn = ANALYTIC_KEYS.every((k) => prefs[k]);
  // The thank-you letter rides along only when everything else is shared too.
  const cards: { key: string; special: boolean }[] = [
    ...ANALYTIC_KEYS.filter((k) => prefs[k]).map((key) => ({ key, special: false })),
    ...(allOn && prefs.thanks ? [{ key: 'thanks', special: true }] : []),
  ];
  const anyOn = cards.length > 0;
  return (
    <div className="obv2-art obv2-art-bottom flex-1 flex items-end justify-center min-h-0 pb-4">
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
interface Card {
  id: string;
  name: string;
  Icon: TablerIcon;
  value?: string;
  toggle?: boolean;
  on: boolean;
  /** The area (book) this device lives in — sections the dashboard. */
  area?: string;
}

/** The floors/areas the user just built, as plain names for the dashboard. */
interface FloorSection {
  name: string;
  areas: string[];
}

function makeCard(L: Copy, i: number, idPrefix = 'card'): Card {
  const d = L.devices[i % L.devices.length];
  return {
    id: `${idPrefix}-${i}`,
    name: d.name,
    Icon: DEVICE_ICONS[i % DEVICE_ICONS.length],
    value: d.value,
    toggle: d.toggle,
    on: i % 3 !== 1,
  };
}

function MiniToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        // Cards open their preview on tap — the toggle must not.
        e.stopPropagation();
        onToggle();
      }}
      className="w-[42px] h-[26px] shrink-0 rounded-full p-[3px] transition-colors duration-200"
      style={{ background: on ? ACCENT : '#e3e3e3' }}
    >
      <span
        className="block size-[20px] rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? 'translateX(16px)' : undefined }}
      />
    </button>
  );
}

type DashView = 'dashboard' | 'profile';
type SheetTab = 'search' | 'activity' | 'dashboards';

/** One continuous fade per bar — near-solid behind the controls, running out
    to transparent past the bar's edge. Content scrolls through underneath. */
const barFade = (dir: 'top' | 'bottom'): React.CSSProperties => ({
  background: `linear-gradient(to ${dir === 'top' ? 'bottom' : 'top'}, rgba(230,230,230,0.97) 45%, rgba(230,230,230,0))`,
});

function DashboardStep({
  homeName,
  username,
  invited,
  initialCards,
  structure,
  L,
  onBack,
}: {
  homeName: string;
  username: string;
  invited: Invitee[];
  initialCards: Card[];
  structure: FloorSection[];
  L: Copy;
  onBack: () => void;
}) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [menuOpen, setMenuOpen] = useState(false);
  // Home is the grid; profile is its own page. The other tabs (and home's
  // second tap) raise a near-full-height sheet out of the nav — the light
  // version of the app's MobileNav pull-up surface.
  const [view, setView] = useState<DashView>('dashboard');
  const [sheetTab, setSheetTab] = useState<SheetTab | null>(null);
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Auto-hide: the nav ducks away on scroll-down and returns on scroll-up —
  // same accumulate-travel-per-direction reflex as the app's MobileNav.
  const [navHidden, setNavHidden] = useState(false);
  const lastY = useRef(0);
  const travel = useRef(0);
  // Grabber-driven drag-to-dismiss for the pull-up sheet (the content below
  // it has to keep scrolling normally, so only the grabber drags).
  const sheetDrag = useDragControls();
  const onGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const delta = top - lastY.current;
    lastY.current = top;
    if (top <= 2) {
      travel.current = 0;
      setNavHidden(false);
      return;
    }
    // Reset the tally when the direction flips so jitter can't creep over.
    travel.current = (travel.current > 0) === (delta > 0) ? travel.current + delta : delta;
    if (travel.current >= 24) setNavHidden(true);
    else if (travel.current <= -16) setNavHidden(false);
  };
  const navDucked = navHidden && view === 'dashboard' && !sheetTab && !previewId;

  // New devices land in the areas round-robin, so every room fills up.
  const allAreas = structure.flatMap((f) => f.areas);
  const addCard = () =>
    setCards((prev) => [
      ...prev,
      { ...makeCard(L, prev.length, `card-${Date.now()}`), area: allAreas[prev.length % allAreas.length] },
    ]);
  const flip = (id: string) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, on: !c.on } : c)));
  const previewCard = cards.find((c) => c.id === previewId) ?? null;

  // Search dedupes on the device name — the grid may hold several of each.
  const q = query.trim().toLowerCase();
  const matches = cards.filter(
    (c, i) => c.name.toLowerCase().includes(q) && cards.findIndex((o) => o.name === c.name) === i,
  );

  const homeIdle = view === 'dashboard' && sheetTab === null;
  // The chevron bounces on the first few arrivals at the home tab, then just
  // sits there — learned affordances shouldn't keep waving.
  const [homeArrivals, setHomeArrivals] = useState(0);
  const bumpArrival = () => setHomeArrivals((n) => Math.min(n + 1, 9));
  const tapHome = () => {
    if (!homeIdle) {
      setView('dashboard');
      setSheetTab(null);
      bumpArrival();
      return;
    }
    // Already home: the chevron promised more — the dashboard picker.
    setSheetTab('dashboards');
  };
  const toggleSheet = (t: SheetTab) => {
    setView('dashboard');
    if (t === 'search') setQuery('');
    const next = sheetTab === t ? null : t;
    if (next === null) bumpArrival();
    setSheetTab(next);
  };

  const homeActive = view === 'dashboard' && (sheetTab === null || sheetTab === 'dashboards');
  const homeTitle = homeName.trim() || L.homeFallback;
  const allDashboards = [
    { name: homeTitle, Icon: IconHome, active: true },
    ...L.dashboards.map((name, i) => ({ name, Icon: DASH_ICONS[i], active: false })),
  ];

  return (
    <>
      {/* everything behind the pull-up sheet recedes slightly while it's up */}
      <div
        className={clsx('absolute inset-0 transition-transform duration-300 ease-out', sheetTab && 'scale-[0.955]')}
        style={{ transformOrigin: '50% 32%' }}
      >
      {/* the card grid scrolls edge to edge, under both frosted bars —
          sectioned by the floors and areas built during onboarding */}
      <div className="absolute inset-0 overflow-y-auto" onScroll={onGridScroll}>
        {(() => {
          const gridCls = 'grid grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2 md:gap-3';
          const tile = (card: Card) => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              onClick={() => setPreviewId(card.id)}
              className="relative bg-white rounded-[24px] p-2 flex flex-col gap-2 cursor-pointer"
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
                  {card.toggle ? (card.on ? L.on : L.off) : card.value}
                </span>
              </div>
            </motion.div>
          );
          return (
            <div className="px-4 pt-[calc(env(safe-area-inset-top)+76px)] pb-[calc(env(safe-area-inset-bottom)+104px)] flex flex-col gap-5">
              {structure.length === 0 ? (
                // no floors/areas were set up — the flat starter grid
                <div className={gridCls}>{cards.map(tile)}</div>
              ) : (
                structure.map((floor) => (
                  <div key={floor.name} className="flex flex-col gap-3">
                    {/* the floor eyebrow only earns its ink with 2+ floors */}
                    {structure.length > 1 && (
                      <span className="px-1 text-[13px] font-semibold" style={{ color: TEXT_DIM }}>
                        {floor.name}
                      </span>
                    )}
                    {floor.areas.map((area) => (
                      <div key={area} className="flex flex-col gap-2">
                        <span className="px-1 text-[16px] font-semibold tracking-[-0.32px]" style={{ color: TEXT }}>
                          {area}
                        </span>
                        <div className={gridCls}>{cards.filter((c) => c.area === area).map(tile)}</div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          );
        })()}
      </div>

      {/* profile: its own page — the first column of the app's settings */}
      {view === 'profile' && (
        <div className="absolute inset-0 z-10 overflow-y-auto" style={{ background: SURFACE }}>
          <div className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+104px)] flex flex-col gap-4 w-full max-w-[640px] mx-auto">
            <div className="flex items-center gap-3 px-1">
              <span className="size-[56px] rounded-full bg-white flex items-center justify-center shrink-0">
                <IconUser size={28} color={TEXT_2} />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[20px] font-semibold tracking-[-0.4px] truncate" style={{ color: TEXT }}>
                  {username.trim() || L.admin}
                </span>
                <span className="text-[14px] font-semibold" style={{ color: TEXT_2 }}>
                  {L.yourHome}: {homeTitle}
                </span>
              </div>
            </div>
            {L.settings.map((section, si) => (
              <div key={si} className="flex flex-col gap-1.5">
                {section.title && (
                  <span className="px-2 text-[13px] font-semibold" style={{ color: TEXT_DIM }}>
                    {section.title}
                  </span>
                )}
                <div className="bg-white rounded-[24px] p-1.5 flex flex-col">
                  {section.items.map((label, ii) => {
                    const Icon = SETTINGS_ICONS[si][ii];
                    return (
                      <Press key={label} className="flex items-center gap-3 px-2 py-1.5 rounded-[18px] text-left">
                        <span className="size-[38px] rounded-[12px] bg-[#f3f3f3] flex items-center justify-center shrink-0">
                          <Icon size={19} color={TEXT_2} />
                        </span>
                        <span className="flex-1 min-w-0 text-[15px] font-semibold tracking-[-0.3px] truncate" style={{ color: TEXT }}>
                          {label}
                        </span>
                        <IconChevronRight size={17} color={TEXT_DIM} className="shrink-0" />
                      </Press>
                    );
                  })}
                </div>
              </div>
            ))}
            {invited.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="px-2 text-[13px] font-semibold" style={{ color: TEXT_DIM }}>
                  {L.people}
                </span>
                <div className="bg-white rounded-[24px] p-1.5 flex flex-col">
                  {[{ name: username.trim() || L.admin, role: L.admin }, ...invited.map((p) => ({ name: p.email, role: p.admin ? L.admin : L.guest }))].map(
                    ({ name, role }) => (
                      <div key={name} className="flex items-center gap-3 px-2 py-1.5">
                        <span className="shrink-0 w-[38px] flex justify-center">
                          <KeySvg cutSeed={name} styleSeed={name} color={INK} height={34} />
                        </span>
                        <span className="flex-1 min-w-0 text-[15px] font-semibold tracking-[-0.3px] truncate" style={{ color: TEXT }}>
                          {name}
                        </span>
                        <span className="text-[13px] font-semibold shrink-0" style={{ color: TEXT_DIM }}>
                          {role}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* top app bar — the grid slides through the fade underneath */}
      {view === 'dashboard' && (
        <div className="absolute top-0 inset-x-0 z-20 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-2">
          <div aria-hidden className="absolute inset-x-0 top-0 -bottom-12 pointer-events-none" style={barFade('top')} />
          <div className="relative flex items-center justify-between min-h-[44px]">
            <Press
              onClick={() => setMenuOpen((v) => !v)}
              className="min-h-[44px] px-4 rounded-full bg-white/80 flex items-center gap-2"
            >
              <IconHome size={20} color="#707078" />
              <span className="text-[16px] font-semibold tracking-[-0.48px] max-w-[160px] truncate" style={{ color: '#707078' }}>
                {homeTitle}
              </span>
              <IconChevronDown
                size={18}
                color="#707078"
                style={{ transform: menuOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
              />
            </Press>
            <PopMenu
              open={menuOpen}
              onPick={() => setMenuOpen(false)}
              onPickItem={(i) => i === 0 && onBack()}
              items={L.dashMenu}
            />
            <Press aria-label="Add to home" onClick={addCard} className="size-[44px] rounded-full flex items-center justify-center" style={{ background: ACCENT }}>
              <IconPlus size={22} color="white" />
            </Press>
          </div>
        </div>
      )}

      </div>

      {/* the pull-up sheet: search, activity, and the dashboard picker */}
      <AnimatePresence>
        {sheetTab && (
          <>
          <motion.div
            key="sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSheetTab(null)}
            className="absolute inset-0 z-[25] bg-black/25"
          />
          <motion.div
            key="dash-sheet"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            drag="y"
            dragListener={false}
            dragControls={sheetDrag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) setSheetTab(null);
            }}
            className="absolute inset-x-0 bottom-0 z-30 w-full max-w-[640px] mx-auto bg-white rounded-t-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden"
            style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}
          >
            <div
              className="w-full pt-3 pb-2 -mb-2 shrink-0 cursor-grab touch-none flex justify-center"
              onPointerDown={(e) => sheetDrag.start(e)}
            >
              <div className="w-[40px] h-[4px] rounded-full bg-[#e6e6e6]" />
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={sheetTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="flex-1 min-h-0 flex flex-col gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+96px)]"
              >
                {sheetTab === 'search' && (
                  <>
                    <div className="w-full bg-[#f3f3f3] rounded-full min-h-[48px] px-4 flex items-center gap-2 shrink-0">
                      <IconSearch size={18} color={TEXT_DIM} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={L.searchPh}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[16px] font-semibold tracking-[-0.32px] placeholder:text-[#989898]"
                        style={{ color: TEXT }}
                      />
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                      {matches.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 px-2 py-2.5">
                          <span className="size-[38px] rounded-full bg-[#f3f3f3] flex items-center justify-center shrink-0">
                            <c.Icon size={19} color={TEXT_2} />
                          </span>
                          <span className="flex-1 min-w-0 text-[15px] font-semibold tracking-[-0.3px] truncate" style={{ color: TEXT }}>
                            {c.name}
                          </span>
                          {c.toggle ? (
                            <MiniToggle on={c.on} onToggle={() => flip(c.id)} />
                          ) : (
                            <span className="text-[14px] font-semibold" style={{ color: TEXT_2 }}>{c.value}</span>
                          )}
                        </div>
                      ))}
                      {matches.length === 0 && (
                        <span className="text-center py-5 text-[14px] font-semibold" style={{ color: TEXT_DIM }}>
                          {L.noResults}
                        </span>
                      )}
                    </div>
                  </>
                )}
                {sheetTab === 'activity' && (
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                    {cards.slice(0, 8).map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 px-2 py-2.5">
                        <span
                          className="size-[8px] rounded-full shrink-0"
                          style={{ background: c.on ? ACCENT : '#d4d4d4' }}
                        />
                        <span className="flex-1 min-w-0 text-[15px] font-semibold tracking-[-0.3px] truncate" style={{ color: TEXT }}>
                          {L.actLine(c.name, c.on)}
                        </span>
                        <span className="text-[13px] font-semibold shrink-0" style={{ color: TEXT_DIM }}>
                          {L.times[i % L.times.length]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {sheetTab === 'dashboards' && (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      {allDashboards.map((d) => (
                        <Press
                          key={d.name}
                          onClick={() => setSheetTab(null)}
                          className="flex flex-col gap-1.5 p-1.5 rounded-[16px]"
                          style={{ background: d.active ? '#eef6f9' : undefined }}
                        >
                          {/* the little layout mock, same idea as the app's dashboard cards */}
                          <span className="w-full aspect-[3/4] rounded-[14px] bg-[#f3f3f3] p-2 flex flex-col gap-1.5">
                            <span className="h-2 rounded-full w-full" style={{ background: d.active ? 'rgba(0,154,199,0.25)' : '#e2e2e2' }} />
                            <span className="h-2 rounded-full w-3/4" style={{ background: d.active ? 'rgba(0,154,199,0.25)' : '#e2e2e2' }} />
                            <span className="h-3 rounded-[6px] w-full mt-1" style={{ background: d.active ? 'rgba(0,154,199,0.25)' : '#e2e2e2' }} />
                            <span className="h-3 rounded-[6px] w-full" style={{ background: d.active ? 'rgba(0,154,199,0.25)' : '#e2e2e2' }} />
                          </span>
                          <span className="flex items-center gap-1 px-0.5 min-w-0">
                            <d.Icon size={15} color={d.active ? ACCENT : TEXT_2} className="shrink-0" />
                            <span className="text-[12px] font-semibold truncate" style={{ color: d.active ? TEXT : TEXT_2 }}>
                              {d.name}
                            </span>
                          </span>
                        </Press>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* bottom nav — on scroll-down it shrinks into a small iOS-style
          handle; scroll up or tap it and the full bar grows back */}
      {/* bottom gap matches the side margins — the pill tucks right into the
          corner like the iOS tab bar, home indicator floating over the gap */}
      <div className="absolute bottom-0 inset-x-0 z-40 px-4 pt-2 pb-4">
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -top-10 pointer-events-none transition-opacity duration-200"
          style={{ ...barFade('bottom'), opacity: sheetTab ? 0 : 1 }}
        />
        <div
          onClick={navDucked ? () => setNavHidden(false) : undefined}
          className={clsx(
            'relative mx-auto rounded-full overflow-hidden transition-all duration-200 ease-out',
            navDucked ? 'h-[10px] w-[88px] opacity-50 cursor-pointer' : 'h-[64px] w-full max-w-[430px] opacity-100',
          )}
          style={{ background: INK }}
        >
          <div
            className={clsx(
              'h-[64px] w-full px-8 flex items-center justify-between transition-opacity duration-150',
              navDucked && 'opacity-0 pointer-events-none',
            )}
          >
            <Press aria-label="Home" onClick={tapHome} className="relative p-2">
              {/* the chevron hints there's more behind a second tap; the y-nudge
                  (transform) composes with the x-centering (translate property) */}
              <span
                key={homeArrivals}
                aria-hidden
                className="absolute -top-[8px] left-1/2 -translate-x-1/2 transition-opacity duration-300"
                style={{
                  opacity: homeIdle ? 1 : 0,
                  animation: homeIdle && homeArrivals <= 3 ? 'obv2-nudge 1.4s ease 0.5s 3' : undefined,
                }}
              >
                <IconChevronUp size={13} color="#8a8a8a" />
              </span>
              <IconHome size={26} color={homeActive ? '#ffffff' : '#8a8a8a'} />
            </Press>
            <Press aria-label="Search" onClick={() => toggleSheet('search')} className="p-2">
              <IconSearch size={26} color={sheetTab === 'search' ? '#ffffff' : '#8a8a8a'} />
            </Press>
            <Press aria-label="Activity" onClick={() => toggleSheet('activity')} className="p-2">
              <IconClockHour4 size={26} color={sheetTab === 'activity' ? '#ffffff' : '#8a8a8a'} />
            </Press>
            <Press
              aria-label="Profile"
              onClick={() => {
                setSheetTab(null);
                if (view === 'profile') bumpArrival();
                setView((v) => (v === 'profile' ? 'dashboard' : 'profile'));
              }}
              className="p-1"
            >
              {/* the avatar wears the same cap color as the user's key */}
              <span
                className="size-[30px] rounded-full flex items-center justify-center transition-shadow duration-200"
                style={{
                  background: capColorFor(username || 'admin'),
                  boxShadow: view === 'profile' && !sheetTab ? '0 0 0 2.5px #ffffff' : undefined,
                }}
              >
                <IconUser size={19} color="#ffffff" />
              </span>
            </Press>
          </div>
        </div>
      </div>

      {/* Device preview — tap a card, get its sheet. Close lives on the left. */}
      <AnimatePresence>
        {previewCard && (
          <>
            <motion.div
              key="preview-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setPreviewId(null)}
              className="absolute inset-0 z-40 bg-black/30"
            />
            <motion.div
              key="preview-sheet"
              initial={{ opacity: 0, y: 70 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 70 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="absolute inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none"
            >
              <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.7 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 70 || info.velocity.y > 500) setPreviewId(null);
                }}
                className="pointer-events-auto w-full max-w-[430px] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
              >
                <div className="bg-white rounded-[32px] p-4 pt-2 flex flex-col gap-1">
                  <div className="mx-auto w-[40px] h-[4px] rounded-full bg-[#e6e6e6] mb-2" />
                  <div className="flex items-center justify-between">
                    <Press
                      aria-label="Close"
                      onClick={() => setPreviewId(null)}
                      className="size-[40px] rounded-full bg-[#f3f3f3] flex items-center justify-center"
                    >
                      <IconX size={19} color={TEXT_2} />
                    </Press>
                    {previewCard.toggle && <MiniToggle on={previewCard.on} onToggle={() => flip(previewCard.id)} />}
                  </div>
                  <div className="flex flex-col items-center pt-2 pb-5 gap-3">
                    <span className="size-[84px] rounded-[26px] bg-[#f3f3f3] flex items-center justify-center">
                      <previewCard.Icon size={38} color={previewCard.toggle && !previewCard.on ? TEXT_2 : TEXT} />
                    </span>
                    <div className="flex flex-col items-center">
                      <span className="text-[19px] font-semibold tracking-[-0.38px]" style={{ color: TEXT }}>
                        {previewCard.name}
                      </span>
                      <span className="text-[16px] font-semibold tracking-[-0.32px]" style={{ color: previewCard.toggle && previewCard.on ? ACCENT : TEXT_2 }}>
                        {previewCard.toggle ? (previewCard.on ? L.on : L.off) : previewCard.value}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
  const [lang, setLang] = useState<Lang>('en');
  const L = STR[lang];
  const [homeName, setHomeName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invited, setInvited] = useState<Invitee[]>([]);
  const [inviteDraft, setInviteDraft] = useState('');
  // Grayed-out "who might live here" keys floating beside the ring —
  // randomly cut on every visit.
  const [ghostSeeds] = useState(() =>
    Array.from({ length: 2 }, () => Math.random().toString(36).slice(2, 9)),
  );
  const [location, setLocation] = useState<LatLng | null>(null);
  const [mapActive, setMapActive] = useState(false);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locQuery, setLocQuery] = useState('');
  const [locSuggestions, setLocSuggestions] = useState<{ name: string; lat: number; lng: number }[]>([]);
  // Picking a suggestion writes it back into the field — that write must not
  // immediately re-open the dropdown.
  const skipSuggest = useRef(false);
  const [flag, setFlag] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [floors, setFloors] = useState(1);
  const [floorIndex, setFloorIndex] = useState(0);
  const [booksByFloor, setBooksByFloor] = useState<Book[][]>([[]]);
  const [customRooms, setCustomRooms] = useState<string[]>([]);
  const [credFocused, setCredFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  // lg keeps art and house in ONE proportion: the stage reports its measured
  // width and the art scale follows it (460 = the reference design width).
  // Below lg the media-query scale applies instead.
  const stageRef = useRef<HTMLDivElement>(null);
  const inDashboard = step === 'dashboard';
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const apply = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        // 617 is the reference width the scenes were composed at; the welcome
        // still life applies its own fit factor on top (see .obv2-welcome).
        el.style.setProperty('--obv2-art-scale', (el.clientWidth / 617).toFixed(3));
      } else {
        el.style.removeProperty('--obv2-art-scale');
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [inDashboard]);

  // Discovery never waits for onboarding: HA starts scanning the network the
  // moment it boots, so devices trickle in while the user is still at the door.
  const [found, setFound] = useState(0);
  const [welcomeMenuOpen, setWelcomeMenuOpen] = useState(false);
  const [a11yMenuOpen, setA11yMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ id: string; msg: string; seq: number } | null>(null);
  // Touch devices get the choreographed focus: artwork settles into its
  // keyboard framing first, THEN the field focuses and the keyboard rises.
  const [coarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );

  // On iOS the keyboard doesn't shrink a fixed layout — the browser pans the
  // page instead, shoving the artwork out of view. Sizing the column from the
  // visual viewport makes the layout genuinely shrink above the keyboard, and
  // `compact` swaps the artwork to keyboard-sized proportions.
  const [vp, setVp] = useState<{ h: number; max: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const h = Math.round(vv.height);
      // Home-screen (standalone) launches can report a bogus tiny height
      // mid launch-transition; trusting it collapses the column to nothing
      // and no resize event may follow. Even a keyboard leaves ~300px.
      if (h < 200) return;
      setVp((prev) => ({ h, max: Math.max(prev?.max ?? 0, h) }));
      // iOS also PANS the page toward the focused input before (and sometimes
      // despite) the resize — snap the pan back, the layout already fits.
      if (window.scrollY || vv.offsetTop) window.scrollTo(0, 0);
    };
    update();
    // Standalone launches don't always fire a visualViewport resize once the
    // transition settles — re-measure shortly after, and on window resize too.
    const settle = setTimeout(update, 350);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(settle);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  const vvh = vp?.h ?? null;
  // Keyboard = the viewport lost real height against the best we've seen, or
  // it's outright short. A fixed 560px cutoff misses large iPhones.
  const compact = vp !== null && (vp.h < 560 || vp.h < vp.max - 100);
  // While actually typing with the keyboard up, only the inputs matter — the
  // continue button may fall out of frame (hidden via .obv2-hide-cta).
  const [typing, setTyping] = useState(false);

  // A stable `id` updates an existing toast in place (same key → no re-mount,
  // no re-animation) while each call still extends its lifetime via `seq`.
  const toastSeq = useRef(0);
  const showToast = (msg: string, id?: string) => {
    const seq = ++toastSeq.current;
    setToast({ id: id ?? `t-${seq}`, msg, seq });
    setTimeout(() => setToast((t) => (t && t.seq === seq ? null : t)), 2800);
  };

  // Each newly discovered device re-raises the toast with the running count.
  useEffect(() => {
    if (step !== 'welcome' || found >= 7) return;
    const t = setTimeout(() => {
      const n = found + 1;
      setFound(n);
      // Stable id: the toast appears once and only its count changes after.
      showToast(L.discoveredLine(n), 'discovery');
    }, 2400);
    return () => clearTimeout(t);
  }, [step, found, L]);

  // Invites always create guest accounts; promotion happens in settings later.
  const addInvite = useCallback(
    (email: string) =>
      setInvited((prev) => (prev.some((p) => p.email === email) ? prev : [...prev, { email, admin: false }])),
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

  // Tapping a tipped book stands it back up.
  const straightenBook = useCallback((id: string) => {
    setBooksByFloor((prev) => prev.map((f) => f.map((b) => (b.id === id ? { ...b, lean: 0 } : b))));
  }, []);

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
  // under the marker, and the sheet spells out the address. Key-less reverse
  // geocoding; failures just mean no flag and no address.
  useEffect(() => {
    if (step !== 'location' || !location) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lng}&localityLanguage=${lang}`,
        );
        const j = await r.json();
        const cc: string = j.countryCode || '';
        if (cc.length === 2) {
          setFlag(String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0))));
        }
        const parts = [j.locality || j.city, j.principalSubdivision, j.countryName]
          .filter(Boolean)
          .filter((p, i, arr) => arr.indexOf(p) === i);
        if (parts.length) setAddress(parts.join(', '));
      } catch {
        /* offline or blocked — no flag, no harm */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [step, location, lang]);

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

  // Forward geocode via Nominatim (key-less, CORS-open) — the map flies to
  // the top hit and panning takes over from there.
  const searchAddress = async () => {
    const q = locQuery.trim();
    if (!q) return;
    setLocSuggestions([]);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=${lang}`,
      );
      const j = await r.json();
      if (j[0]) {
        const here = { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
        setCenter(here);
        setLocation(here);
        setMapActive(true);
      }
    } catch {
      /* offline or blocked — the map stays where it was */
    }
  };

  // Typing pulls a handful of address suggestions, gently debounced.
  useEffect(() => {
    if (step !== 'location') return;
    const q = locQuery.trim();
    const t = setTimeout(async () => {
      if (skipSuggest.current) {
        skipSuggest.current = false;
        return;
      }
      if (q.length < 3) {
        setLocSuggestions([]);
        return;
      }
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=${lang}`,
        );
        const j: { display_name: string; lat: string; lon: string }[] = await r.json();
        setLocSuggestions(j.map((it) => ({ name: it.display_name, lat: parseFloat(it.lat), lng: parseFloat(it.lon) })));
      } catch {
        /* offline — no suggestions, search still works on Enter */
      }
    }, 450);
    return () => clearTimeout(t);
  }, [step, locQuery, lang]);

  const pickSuggestion = (s: { name: string; lat: number; lng: number }) => {
    const here = { lat: s.lat, lng: s.lng };
    setCenter(here);
    setLocation(here);
    setMapActive(true);
    setLocSuggestions([]);
    skipSuggest.current = true;
    setLocQuery(s.name.split(',')[0]);
  };

  const inviteValid = /\S+@\S+\.\S+/.test(inviteDraft.trim());
  const submitInvite = () => {
    const email = inviteDraft.trim();
    if (!inviteValid) return;
    addInvite(email);
    setInviteDraft('');
    showToast(L.inviteToast(email));
  };

  // The floors/areas just built become the dashboard's sections; each area
  // starts with one or two example devices. Six flat placeholders if the
  // structure steps were skipped entirely.
  const structure: FloorSection[] = booksByFloor
    .map((shelf, i) => ({ name: floorName(L, i), areas: shelf.map((b) => b.room) }))
    .filter((f) => f.areas.length > 0);
  let seedIdx = 0;
  const cards: Card[] = structure.length
    ? structure.flatMap((f) =>
        f.areas.flatMap((area) =>
          Array.from({ length: 1 + (keyHash(area) % 2) }, () => ({ ...makeCard(L, seedIdx++, 'seed'), area })),
        ),
      )
    : Array.from({ length: 6 }, (_, i) => makeCard(L, i, 'seed'));

  const next = () => {
    // welcome → name: no slide — the scene fades and the shared-layout door
    // carries over (see layoutId="obv2-door")
    setDir(step === 'welcome' ? 0 : 1);
    setToast(null);
    if (step === 'areas' && floorIndex < floors - 1) {
      setFloorIndex(floorIndex + 1);
      return;
    }
    if (step === 'floors') setFloorIndex(0);
    setStep(ORDER[ORDER.indexOf(step) + 1]);
  };
  const back = () => {
    setDir(step === 'name' ? 0 : -1);
    setToast(null);
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
        // The welcome heading lives display-sized in the artboard instead.
        return { title: null };
      case 'name':
        return { title: L.nameTitle };
      case 'users':
        return { title: L.usersTitle };
      case 'invite':
        return { title: L.inviteTitle, sub: L.inviteSub };
      case 'location':
        return { title: L.locTitle, sub: L.locSub };
      case 'floors':
        return { title: L.floorsTitle, sub: L.floorsSub };
      case 'areas':
        return {
          title: (
            <>
              <span style={{ color: TEXT_2 }}>{L.areasOn}</span>
              <span>{floorName(L, floorIndex).toLowerCase()}</span>
            </>
          ),
          sub: L.areasSub,
        };
      case 'permissions':
        return { title: L.permTitle, sub: L.permSub };
      default:
        return { title: '' };
    }
  })();

  const allAnalyticsOn = ANALYTIC_KEYS.every((k) => prefs[k]);

  // lg split layout: the welcome step's in-art heading moves to the form pane.
  const paneTitle = step === 'welcome' ? L.welcomeTitle : heading.title;
  const paneSub = step === 'welcome' ? L.welcomeSub : heading.sub;

  const art = (() => {
    switch (step) {
      case 'welcome':
        return <WelcomeArt homeName={homeName} L={L} />;
      case 'name':
        return (
          <div className="flex-1 flex flex-col items-center min-h-0 overflow-hidden py-2">
            {/* Phones: spacers centre the door; on focus the top one gives way
                so the scene glides up and the nameplate stays in view above
                the keyboard crop. Large screens zoom into the door instead. */}
            <div
              aria-hidden
              className={clsx(
                'transition-[flex-grow] duration-500',
                nameFocused ? '[flex-grow:0.12] lg:[flex-grow:1]' : '[flex-grow:1]',
              )}
            />
            <div className={clsx('obv2-name-door shrink-0', nameFocused && 'obv2-zoomed')}>
              <motion.div layoutId="obv2-door">
                <Door name={homeName} height={310} />
              </motion.div>
            </div>
            {/* lg: the door sits low in the house so its top clears the roof */}
            <div aria-hidden className="[flex-grow:1] lg:[flex-grow:0.3]" />
          </div>
        );
      case 'users':
        return (
          <div className="obv2-art obv2-keys flex-1 flex items-center justify-center min-h-0 overflow-hidden">
            {/* Focusing a credential turns the key horizontal, ready for its lock. */}
            <div
              className="transition-transform duration-500 ease-out"
              style={{
                transform: credFocused
                  ? `rotate(-90deg) scale(${coarse || compact ? 0.62 : 0.9})`
                  : compact
                    ? 'scale(0.68)'
                    : undefined,
              }}
            >
              <Keychain
                keys={[{ id: 'admin', cutSeed: password || 'password', styleSeed: username || 'admin', color: INK }]}
                keyHeight={110}
                ringSize={72}
              />
            </div>
          </div>
        );
      case 'invite':
        return (
          <div className="obv2-art obv2-keys flex-1 flex items-center justify-center min-h-0 relative overflow-hidden">
            {/* the ring holds exactly your key + everyone invited */}
            <div
              className="relative transition-transform duration-500 ease-out"
              style={{ transform: compact ? 'scale(0.68)' : undefined }}
            >
              <Keychain
                keys={[
                  { id: 'admin', cutSeed: password || 'password', styleSeed: username || 'admin', color: INK },
                  ...invited.map((p) => ({ id: `inv-${p.email}`, cutSeed: p.email, styleSeed: p.email, color: p.admin ? INK : TEXT_2 })),
                ]}
                keyHeight={110}
                ringSize={72}
              />
              {/* two not-yet-connected keys float above the ring's shoulders;
                  typing an email gives one of them its hue and cuts it live */}
              {[
                { cls: '-left-[88px] -top-[12px]', rot: -16, dur: '3.4s', delay: '0s', active: false },
                { cls: '-right-[92px] -top-[30px]', rot: 18, dur: '3.9s', delay: '0.9s', active: true },
              ].map((f, i) => {
                const draft = inviteDraft.trim();
                const live = f.active && draft.length > 0;
                const seed = live ? draft : ghostSeeds[i] ?? `maybe-${i}`;
                return (
                  <div
                    key={i}
                    aria-hidden
                    className={clsx('absolute pointer-events-none', f.cls)}
                    style={{ animation: `obv2-bob ${f.dur} ease-in-out ${f.delay} infinite` }}
                  >
                    <div style={{ transform: `rotate(${f.rot}deg)` }}>
                      <KeySvg
                        cutSeed={seed}
                        styleSeed={seed}
                        color={live ? TEXT_2 : '#cfcfcf'}
                        capColor={live ? undefined : '#e0e0e0'}
                        height={72}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'location':
        return (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-2 lg:translate-y-[8%]">
            {/* the frame hangs from a wire on a nail, like any picture would */}
            <svg aria-hidden width="160" height="44" viewBox="0 0 160 44" fill="none" className="-mb-[6px] shrink-0">
              <path d="M8 44 L80 7 L152 44" stroke="#c9c9c9" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="80" cy="6" r="4" fill="#bdbdbd" />
            </svg>
            {/* A landscape photo frame; focusing it develops the photo into a
                real, draggable map with the home badge fixed dead-centre. */}
            <div className="w-full max-w-[350px] md:max-w-[480px] lg:max-w-[58%] bg-white rounded-[20px] p-2 pb-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col items-center gap-1">
              <div className="w-full h-[250px] md:h-[320px] lg:h-[280px] rounded-[14px] overflow-hidden bg-[#edf3f5]">
                {mapActive ? (
                  <MapPicker center={center} onChange={setLocation} />
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
              {/* the hint gives way to the address once panning finds one */}
              <span
                key={address ?? 'hint'}
                className="text-[14px] font-semibold tracking-[-0.28px] py-1 truncate max-w-full px-2"
                style={{ color: address ? TEXT_2 : TEXT_DIM, animation: 'obv2-fade-in 0.4s ease' }}
              >
                {mapActive ? (address ? `${flag ? `${flag} ` : ''}${address}` : L.dragHome) : L.tapPlace}
              </span>
            </div>
          </div>
        );
      case 'floors':
        return (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
            <ShelfStack L={L} floors={floors} booksByFloor={[]} focusIndex={null} />
          </div>
        );
      case 'areas':
        return <AreasArt L={L} floors={floors} booksByFloor={booksByFloor} floorIndex={floorIndex} onSelectFloor={selectFloor} onStraighten={straightenBook} />;
      case 'permissions':
        return <MailboxArt prefs={prefs} />;
      default:
        return null;
    }
  })();

  const sheet = (() => {
    switch (step) {
      case 'welcome':
        return <CtaButton label={L.begin} onClick={next} />;
      case 'name':
        return (
          <>
            {/* a single scrollable rail of ready-made names */}
            <div className="-mx-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="w-max min-w-full flex justify-center gap-2 px-5">
                {L.nameChips.map((chip) => (
                  <Press
                    key={chip}
                    onClick={() => setHomeName(chip)}
                    className="px-3 py-2 rounded-[12px] text-[14px] font-semibold tracking-[-0.28px] whitespace-nowrap shrink-0"
                    style={{
                      background: homeName === chip ? ACCENT : '#f3f3f3',
                      color: homeName === chip ? '#ffffff' : INK,
                    }}
                  >
                    {chip}
                  </Press>
                ))}
              </div>
            </div>
            <PillInput
              value={homeName}
              onChange={setHomeName}
              placeholder={L.namePh}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
            <CtaButton label={L.cont} onClick={next} arrow disabled={!homeName.trim()} />
          </>
        );
      case 'users':
        return (
          <>
            <PillInput
              value={username}
              onChange={setUsername}
              placeholder={L.userPh}
              delayFocus={coarse}
              onFocus={() => setCredFocused(true)}
              onBlur={() => setCredFocused(false)}
            />
            <PillInput
              value={password}
              onChange={setPassword}
              placeholder={L.passPh}
              secret
              delayFocus={coarse}
              onFocus={() => setCredFocused(true)}
              onBlur={() => setCredFocused(false)}
            />
            <CtaButton label={L.cont} onClick={next} arrow disabled={!username.trim() || !password} />
          </>
        );
      case 'invite':
        return (
          <>
            <div className="w-full bg-[#f3f3f3] rounded-full min-h-[56px] p-2 pl-5 flex items-center justify-between gap-2">
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                value={inviteDraft}
                onChange={(e) => setInviteDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitInvite()}
                placeholder={L.invitePh}
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
                className="min-h-[40px] px-4 rounded-full flex items-center justify-center gap-1.5 shrink-0"
                style={{ background: inviteValid ? ACCENT : '#ffffff', color: inviteValid ? '#fff' : TEXT_2 }}
              >
                <IconUserPlus size={18} />
                <span className="text-[14px] font-semibold tracking-[-0.28px]">{L.inviteSend}</span>
              </Press>
            </div>
            {/* every invite is a guest key — the caption says so instead of
                making the user pick a role mid-onboarding */}
            <p className="text-center text-[13px] tracking-[-0.26px] px-4" style={{ color: TEXT_DIM }}>
              {L.inviteHint}
            </p>
            <CtaButton label={L.cont} onClick={next} arrow disabled={invited.length === 0} />
            <Press onClick={next} className="obv2-cta mx-auto px-4 py-1 text-[15px] font-semibold tracking-[-0.3px]">
              <span style={{ color: TEXT_2 }}>{L.skip}</span>
            </Press>
          </>
        );
      case 'location':
        return (
          <>
            {/* one field does both: type an address, or tap the target to be found */}
            <div className="relative w-full">
              {/* suggested addresses open upward, over the artwork */}
              {locSuggestions.length > 0 && (
                <div className="absolute bottom-full mb-2 inset-x-0 z-20 bg-white rounded-[20px] p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.16)] flex flex-col">
                  {locSuggestions.map((s) => (
                    <Press
                      key={s.name}
                      onClick={() => pickSuggestion(s)}
                      className="text-left px-3.5 py-2 rounded-[14px] hover:bg-[#f3f3f3] min-w-0"
                    >
                      <span className="block text-[14px] font-semibold tracking-[-0.28px] truncate" style={{ color: TEXT }}>
                        {s.name.split(',')[0]}
                      </span>
                      <span className="block text-[12px] truncate" style={{ color: TEXT_DIM }}>
                        {s.name.split(',').slice(1).join(',').trim()}
                      </span>
                    </Press>
                  ))}
                </div>
              )}
            <div className="w-full bg-[#f3f3f3] rounded-full min-h-[56px] p-2 pl-5 flex items-center gap-2">
              <input
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={locQuery}
                onChange={(e) => setLocQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
                placeholder={L.locSearchPh}
                className="flex-1 min-w-0 bg-transparent outline-none text-[17px] font-semibold tracking-[-0.34px] placeholder:text-[#989898]"
                style={{ color: TEXT }}
              />
              {locQuery && (
                <Press
                  aria-label="Search"
                  onClick={searchAddress}
                  className="size-[40px] rounded-full flex items-center justify-center shrink-0"
                  style={{ background: ACCENT }}
                >
                  <IconSearch size={19} color="#ffffff" />
                </Press>
              )}
              <Press
                aria-label={locating ? L.locating : L.locate}
                onClick={locateMe}
                className="size-[40px] rounded-full flex items-center justify-center shrink-0 bg-white"
              >
                <IconCurrentLocation size={19} color={locating ? ACCENT : TEXT_2} />
              </Press>
            </div>
            </div>
            <CtaButton label={L.cont} onClick={next} arrow />
          </>
        );
      case 'floors':
        return (
          <>
            {/* every floor count gets its quip; it says its line and bows out */}
            <div className="min-h-[24px] flex items-center justify-center overflow-hidden">
              <span
                key={`${floors}-${lang}`}
                className="text-center text-[14px] font-semibold tracking-[-0.28px]"
                style={{ color: TEXT_2, animation: 'obv2-quip 3.4s ease forwards' }}
              >
                {L.quips[floors - 1]}
              </span>
            </div>
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
            <CtaButton label={L.cont} onClick={next} arrow />
          </>
        );
      case 'areas':
        return (
          <AreasSheet
            L={L}
            floorIndex={floorIndex}
            booksByFloor={booksByFloor}
            toggleRoom={toggleRoom}
            addCustomRoom={addCustomRoom}
            customRooms={customRooms}
            ctaLabel={floorIndex < floors - 1 ? L.nextFloor : L.cont}
            onNext={next}
          />
        );
      case 'permissions':
        return (
          <>
            {L.analytics.map(({ key, label, desc }) => (
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
                        {L.thanksTitle}
                      </span>
                      <span className="text-[13px] tracking-[-0.26px]" style={{ color: TEXT_2 }}>
                        {L.thanksDesc}
                      </span>
                    </div>
                    <MiniToggle on={!!prefs.thanks} onToggle={() => setPrefs({ ...prefs, thanks: !prefs.thanks })} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <CtaButton label={L.finish} onClick={next} />
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
        /* iOS keyboard show/hide pans the page — anything revealed behind the
           document must match the surface, or it flashes dark. */
        html, body { background: ${SURFACE}; }
        [data-squircle="on"] .onboarding-v2, [data-squircle="on"] .onboarding-v2 * { corner-shape: round; }
        .obv2-hide-cta .obv2-cta { display: none; }
        @keyframes obv2-sway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @keyframes obv2-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes obv2-door-once { 0% { transform: rotateY(0deg); } 45% { transform: rotateY(-34deg); } 100% { transform: rotateY(0deg); } }
        @keyframes obv2-door-hold { 0% { transform: rotateY(0deg); } 13% { transform: rotateY(-46deg); } 80% { transform: rotateY(-44deg); } 100% { transform: rotateY(0deg); } }
        /* the cat leaves the scene the same way the vacuum parks: past the
           phone edge on mobile, past the viewport on wide screens */
        @keyframes obv2-cat-walk { 0% { transform: translateX(0); } 100% { transform: translateX(calc(var(--obv2-vac-park, 300px) + 180px)); } }
        @keyframes obv2-cat-tail { 0%, 100% { transform: rotate(-28deg); } 50% { transform: rotate(-46deg); } }
        @keyframes obv2-jingle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-11deg); } 55% { transform: rotate(8deg); } 80% { transform: rotate(-4deg); } }
        @keyframes obv2-pop { 0%, 100% { transform: scale(1); } 40% { transform: scale(1.14); } }
        @keyframes obv2-pulse { 0% { transform: scale(0.25); opacity: 0.9; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes obv2-quip { 0% { opacity: 0; transform: translateY(6px); } 8%, 78% { opacity: 1; transform: none; } 100% { opacity: 0; transform: none; } }
        @keyframes obv2-swing { 0%, 100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
        @keyframes obv2-fade-in { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: none; } }
        @keyframes obv2-nudge { 0%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } 60% { transform: translateY(1px); } }
        /* The vacuum parks off-frame: past the phone edge on mobile, and far
           enough right on wide screens that it leaves the viewport too. */
        .onboarding-v2 { --obv2-vac-park: 300px; --obv2-art-scale: 1; }
        @media (min-width: 768px) { .onboarding-v2 { --obv2-vac-park: 70vw; } }
        /* The illustrations grow with the screen — stepped so they always fit
           the art region. From lg the art only gets HALF the width (split
           layout), so the steps stay modest; no 4K ambitions. Interactive art
           (map, shelves) sizes via layout instead: a transform would break
           leaflet drags & scrolling. */
        @media (min-width: 768px) and (min-height: 720px) { .onboarding-v2 { --obv2-art-scale: 1.2; } }
        /* on lg the stage element sets --obv2-art-scale inline from its own
           measured size, so art and house stay in one fixed proportion */
        .obv2-art { transform: scale(var(--obv2-art-scale, 1)); }
        .obv2-art-bottom { transform-origin: 50% 100%; }
        /* lg experiment: the whole page is white, and the gray stage shows
           only through a cutout shaped like the Home Assistant house */
        @media (min-width: 1024px) {
          .obv2-stage {
            clip-path: url(#obv2-house);
            background: ${SURFACE};
            overflow: hidden;
          }
          /* the welcome still life fits INSIDE the house: a touch smaller than
             the shared scale and shifted below the roof slope so neither the
             door's top corner nor the shelf clips against the cutout */
          .obv2-art.obv2-welcome { transform: translateY(calc(10% + 40px)) scale(calc(var(--obv2-art-scale, 1) * 0.8)); }
          /* the keychain hangs at the house's OPTICAL centre — the roof
             triangle pulls the shape's mass below the geometric middle */
          .obv2-art.obv2-keys { transform: translateY(12%) scale(var(--obv2-art-scale, 1)); }
        }
        @keyframes obv2-hang-swing { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-8deg); } 60% { transform: rotate(5deg); } 85% { transform: rotate(-2deg); } }
        /* name step, large screens: focusing the input zooms into the door
           instead of sliding the scene (the slide stays for phones) */
        .obv2-name-door { transition: transform 0.6s cubic-bezier(0.32, 0.72, 0.25, 1); transform: scale(var(--obv2-art-scale, 1)); }
        @media (min-width: 1024px) {
          .obv2-name-door.obv2-zoomed { transform: scale(calc(var(--obv2-art-scale, 1) * 1.15)); }
        }
        @keyframes obv2-vacuum { 0%, 45% { transform: translateX(var(--obv2-vac-park, 300px)); } 56% { transform: translateX(46px); } 63% { transform: translateX(66px); } 74% { transform: translateX(-34px); } 82% { transform: translateX(-14px); } 93%, 100% { transform: translateX(var(--obv2-vac-park, 300px)); } }
        .obv2-vac { animation: obv2-vacuum 18s ease-in-out infinite; }
        /* same sweep, but parked off-house for most of a much longer loop */
        @keyframes obv2-vacuum-lg { 0%, 72% { transform: translateX(var(--obv2-vac-park, 300px)); } 78% { transform: translateX(46px); } 81% { transform: translateX(66px); } 87% { transform: translateX(-34px); } 91% { transform: translateX(-14px); } 96%, 100% { transform: translateX(var(--obv2-vac-park, 300px)); } }
        @media (min-width: 1024px) { .obv2-vac { animation: obv2-vacuum-lg 40s ease-in-out infinite; } }
        @keyframes obv2-book-poke { 0%, 100% { transform: rotate(var(--lean, 0deg)); } 30% { transform: rotate(calc(var(--lean, 0deg) + 8deg)); } 65% { transform: rotate(calc(var(--lean, 0deg) - 4deg)); } }
        /* Phones are portrait-only: landscape gets a rotate prompt instead of
           a broken layout. Coarse pointer keeps short desktop windows out. */
        .obv2-rotate { display: none; }
        @media (orientation: landscape) and (max-height: 520px) and (pointer: coarse) {
          .obv2-rotate { display: flex; }
        }
      `}</style>
      {/* the HA-house cutout the lg art stage clips to (objectBoundingBox
          units so it scales with the stage) */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <clipPath id="obv2-house" clipPathUnits="objectBoundingBox">
            <path d="M0.06 0.36 L0.46 0.05 Q0.5 0.02 0.54 0.05 L0.94 0.36 Q0.98 0.4 0.98 0.45 L0.98 0.9 Q0.98 0.98 0.9 0.98 L0.1 0.98 Q0.02 0.98 0.02 0.9 L0.02 0.45 Q0.02 0.4 0.06 0.36 Z" />
          </clipPath>
        </defs>
      </svg>
      {/* full-bleed at every size — inner pieces cap their own widths */}
      <div className="relative w-full" style={{ height: vvh ?? '100%' }}>
        {step === 'dashboard' ? (
          <div className="relative h-full overflow-hidden">
            <DashboardStep homeName={homeName} username={username} invited={invited} initialCards={cards} structure={structure} L={L} onBack={back} />
          </div>
        ) : (
          <div className="h-full flex flex-col lg:bg-white">
            {/* static app bar — the step heading lives here, on a fade that
                runs on below it so artwork dissolves as it nears the bar. */}
            {/* lg: the bar floats over both panes so they run to the top */}
            <div className="px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-1 relative z-20 lg:absolute lg:top-0 lg:inset-x-0 lg:px-6">
              <div
                aria-hidden
                className="absolute top-full -mt-px inset-x-0 h-10 pointer-events-none lg:hidden"
                style={{ background: `linear-gradient(to bottom, ${SURFACE}, transparent)` }}
              />
              <div className="relative flex items-center justify-between gap-2 min-h-[44px] w-full max-w-[640px] mx-auto lg:max-w-[1200px]">
                {step === 'welcome' ? (
                  <Press
                    onClick={() => setWelcomeMenuOpen((v) => !v)}
                    className="min-h-[44px] px-4 rounded-full bg-[#f3f3f3] flex items-center gap-1 shrink-0"
                  >
                    <span className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: TEXT_2 }}>
                      {L.custom}
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
                    {heading.title != null && (
                    <motion.h1
                      key={stepKey}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18 }}
                      className="text-[19px] font-semibold tracking-[-0.38px] truncate max-w-full lg:hidden"
                      style={{ color: TEXT }}
                    >
                      {heading.title}
                    </motion.h1>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {step === 'welcome' && (
                    <Press
                      aria-label="Switch language"
                      onClick={() => setLangMenuOpen((v) => !v)}
                      className="size-[44px] rounded-full bg-[#f3f3f3] flex items-center justify-center"
                    >
                      <span className="text-[13px] font-bold tracking-[0.02em]" style={{ color: TEXT_2 }}>
                        {L.code}
                      </span>
                    </Press>
                  )}
                  <Press
                    aria-label="Accessibility options"
                    onClick={() => setA11yMenuOpen((v) => !v)}
                    className="size-[44px] rounded-full bg-[#f3f3f3] flex items-center justify-center"
                  >
                    <IconAccessible size={24} color={TEXT_2} />
                  </Press>
                </div>
                <PopMenu align="right" open={a11yMenuOpen} onPick={() => setA11yMenuOpen(false)} items={L.a11yMenu} />
                <PopMenu
                  align="right"
                  open={langMenuOpen}
                  onPick={() => setLangMenuOpen(false)}
                  onPickItem={(i) => setLang(LANGS[i])}
                  items={LANGS.map((l) => LANG_NAMES[l])}
                  leading={LANGS.map((l) => LANG_FLAGS[l])}
                />
                {step === 'welcome' && (
                  <PopMenu
                    open={welcomeMenuOpen}
                    onPick={() => setWelcomeMenuOpen(false)}
                    items={L.customMenu}
                  />
                )}
              </div>
              {/* supporting copy under the app bar — folded away when the
                  keyboard is up so the artwork keeps as much room as possible */}
              {heading.sub != null && (
              <div className={clsx('pt-1.5 flex items-start justify-center lg:hidden', compact ? 'hidden' : 'min-h-[40px]')}>
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
              )}
            </div>
            {/* lg: one row splits the screen — the story on the left, the
                action on the right, the whole column capped and centred */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row lg:w-full lg:max-w-[1200px] lg:mx-auto">
            {/* only the artwork slides between steps. lg: the column hugs the
                house; the form pane takes whatever width remains */}
            <div className="flex-1 min-h-0 relative px-5 overflow-hidden lg:flex-none lg:w-1/2 lg:px-0 lg:bg-white lg:flex lg:flex-col lg:items-center lg:justify-center">
              {/* the gray stage lives inside the house-shaped cutout, capped
                  at 600px; the art scales with it in one fixed proportion */}
              <div ref={stageRef} className="obv2-stage relative h-full w-full lg:h-auto lg:w-[min(39vw,68vh,560px)] lg:aspect-square lg:shrink-0">
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
            </div>
            {/* static bottom sheet — its contents crossfade per step. On lg it
                is the right half of the screen: a white pane with the heading
                and the form, vertically centred. */}
            <div className="relative lg:flex-none lg:w-1/2 lg:bg-white lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12 lg:overflow-y-auto">
              {/* toast — discovery ticks, invite confirmations: rises over the sheet */}
              <AnimatePresence>
                {toast && (
                  <div className="absolute -top-[64px] inset-x-0 z-30 flex justify-center pointer-events-none lg:top-auto lg:bottom-10">
                    <motion.div
                      key={toast.id}
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className="rounded-full px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.2)] text-[14px] font-semibold tracking-[-0.28px] max-w-[90%] truncate text-white"
                      style={{ background: INK }}
                    >
                      {toast.msg}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
              {/* runs on past the sheet's top edge so the rounded corners
                  don't notch a hard stop into the gradient */}
              {/* mobile only — on desktop the floating card carries a shadow */}
              <div
                aria-hidden
                className="absolute -top-20 inset-x-0 h-[116px] pointer-events-none lg:hidden"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.10) 36px, transparent)' }}
              />
            {/* lg: the heading leads the form pane — display-sized, centred */}
            <div className="hidden lg:block w-full max-w-[440px] mb-9 text-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={stepKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                >
                  <h1 className="text-[38px] font-semibold tracking-[-1.14px] leading-[1.12]" style={{ color: TEXT }}>
                    {paneTitle}
                  </h1>
                  {paneSub && (
                    <p className="mt-3 text-[16px] leading-snug tracking-[-0.32px] max-w-[400px] mx-auto" style={{ color: TEXT_2 }}>
                      {paneSub}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <div
              className={clsx(
                'relative bg-white rounded-t-[32px] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] w-full max-w-[640px] mx-auto',
                // lg: no card chrome — the form sits naked on the white pane.
                'lg:max-w-[440px] lg:rounded-none lg:shadow-none lg:bg-transparent lg:m-0 lg:p-0',
                compact && typing && 'obv2-hide-cta',
              )}
              onFocusCapture={(e) => {
                if ((e.target as HTMLElement).tagName === 'INPUT') setTyping(true);
              }}
              onBlurCapture={(e) => {
                if ((e.target as HTMLElement).tagName === 'INPUT') setTyping(false);
              }}
            >
              <div className="mx-auto w-[40px] h-[4px] rounded-full bg-[#e6e6e6] mb-2 lg:hidden" />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={stepKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex flex-col gap-2 w-full max-w-[480px] mx-auto lg:max-w-none lg:mx-0"
                >
                  {sheet}
                </motion.div>
              </AnimatePresence>
            </div>
            </div>
            </div>
          </div>
        )}
      </div>
      {/* portrait lock: shown by the media query above on landscape phones */}
      <div className="obv2-rotate fixed inset-0 z-[999] items-center justify-center" style={{ background: SURFACE }}>
        <div className="flex flex-col items-center gap-3 px-8 text-center">
          <IconDeviceMobile size={44} color={TEXT_2} className="rotate-90" />
          <span className="text-[18px] font-semibold tracking-[-0.36px]" style={{ color: TEXT }}>
            {L.rotate}
          </span>
        </div>
      </div>
    </div>
  );
}
