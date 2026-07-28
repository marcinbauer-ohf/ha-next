'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';
import {
  mdiHomeVariant,
  mdiViewDashboard,
  mdiLightningBolt,
  mdiMapMarker,
  mdiHistory,
  mdiCog,
  mdiShieldHome,
  mdiPlayCircle,
} from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { getDashboards, type HaDashboard } from '@/lib/homeassistant';

interface DockItem {
  id: string;
  label: string;
  icon: string;
  /** Absolute URL opened in a new tab; undefined = handled in-app. */
  href?: string;
  accent?: string;
}

/** The handful of mdi names HA dashboards commonly use. */
const MDI_BY_NAME: Record<string, string> = {
  'mdi:view-dashboard': mdiViewDashboard,
  'mdi:home': mdiHomeVariant,
  'mdi:lightning-bolt': mdiLightningBolt,
  'mdi:shield-home': mdiShieldHome,
  'mdi:play-circle': mdiPlayCircle,
  'mdi:map-marker': mdiMapMarker,
};

const DEMO_DASHBOARDS: DockItem[] = [
  { id: 'demo-overview', label: 'Overview', icon: mdiViewDashboard },
  { id: 'demo-energy', label: 'Energy', icon: mdiLightningBolt },
  { id: 'demo-security', label: 'Security', icon: mdiShieldHome },
];

function DockIcon({
  item,
  mouseX,
  onClick,
  highlight,
}: {
  item: DockItem;
  mouseX: MotionValue<number>;
  onClick: () => void;
  highlight?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const distance = useTransform(mouseX, (x) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || x === Infinity) return 999;
    return x - (bounds.left + bounds.width / 2);
  });
  const sizeRaw = useTransform(distance, [-110, 0, 110], [44, 66, 44]);
  const size = useSpring(sizeRaw, { stiffness: 380, damping: 26 });
  const lift = useSpring(useTransform(distance, [-110, 0, 110], [0, -10, 0]), { stiffness: 380, damping: 26 });

  return (
    <div className="group relative flex flex-col items-center">
      <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-full bg-[#0b1220]/85 px-2.5 py-1 text-[11px] text-white/85 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
        {item.label}
      </span>
      <motion.button
        ref={ref}
        type="button"
        aria-label={item.label}
        onClick={onClick}
        className="flex items-center justify-center rounded-2xl border border-white/12 text-white/85"
        style={{
          width: size,
          height: size,
          y: lift,
          background: highlight
            ? 'linear-gradient(160deg, rgba(24,188,242,0.35), rgba(24,188,242,0.12))'
            : 'linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))',
        }}
        whileTap={{ scale: 0.88 }}
      >
        <Icon path={item.icon} size={26} className="pointer-events-none" />
      </motion.button>
      {highlight && <span className="absolute -bottom-2 h-1 w-1 rounded-full bg-[#18bcf2]" />}
    </div>
  );
}

export function SpinDock({ onHome, atHome }: { onHome: () => void; atHome: boolean }) {
  const ha = useHomeAssistant();
  const mouseX = useMotionValue(Infinity);
  const [fetched, setFetched] = useState<DockItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!ha.connected || ha.demoMode) return;
    getDashboards()
      .then((list: HaDashboard[]) => {
        if (cancelled) return;
        setFetched(
          list
            .filter((d) => d.show_in_sidebar)
            .slice(0, 6)
            .map((d) => ({
              id: d.id,
              label: d.title,
              icon: (d.icon && MDI_BY_NAME[d.icon]) || mdiViewDashboard,
              href: ha.haUrl ? `${ha.haUrl}/${d.url_path}` : undefined,
            })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ha.connected, ha.demoMode, ha.haUrl]);

  const dashboards = ha.demoMode ? DEMO_DASHBOARDS : ha.connected ? fetched : [];

  const apps: DockItem[] = [
    { id: 'app-energy', label: 'Energy', icon: mdiLightningBolt, href: ha.haUrl ? `${ha.haUrl}/energy` : undefined },
    { id: 'app-map', label: 'Map', icon: mdiMapMarker, href: ha.haUrl ? `${ha.haUrl}/map` : undefined },
    { id: 'app-history', label: 'History', icon: mdiHistory, href: ha.haUrl ? `${ha.haUrl}/history` : undefined },
    { id: 'app-settings', label: 'Settings', icon: mdiCog, href: ha.haUrl ? `${ha.haUrl}/config/dashboard` : undefined },
  ];

  const open = (item: DockItem) => {
    if (item.href) window.open(item.href, '_blank', 'noopener');
  };

  return (
    <div className="relative z-10 flex justify-center pb-[104px] pt-1">
      <motion.div
        className="flex max-w-[calc(100vw-24px)] items-end gap-2.5 overflow-x-auto rounded-[26px] border border-white/12 bg-[#081020]/45 px-3.5 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        initial={{ opacity: 0, y: 30, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 240, damping: 24 }}
      >
        <DockIcon
          item={{ id: 'home', label: 'Home', icon: mdiHomeVariant }}
          mouseX={mouseX}
          onClick={onHome}
          highlight={atHome}
        />
        {(dashboards.length > 0 || apps.length > 0) && <span className="mx-1 h-9 w-px self-center bg-white/12" />}
        {dashboards.map((d) => (
          <DockIcon key={d.id} item={d} mouseX={mouseX} onClick={() => open(d)} />
        ))}
        {dashboards.length > 0 && <span className="mx-1 h-9 w-px self-center bg-white/12" />}
        {apps.map((a) => (
          <DockIcon key={a.id} item={a} mouseX={mouseX} onClick={() => open(a)} />
        ))}
      </motion.div>
    </div>
  );
}
