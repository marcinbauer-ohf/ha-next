'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useImmersiveMode } from '@/hooks';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { immersiveMode, immersivePhase } = useImmersiveMode();
  const routeTransitionsEnabled = immersivePhase === 'normal';
  const routeStyle = immersiveMode ? { transform: 'none', filter: 'none' } : undefined;

  return (
    <AnimatePresence mode={routeTransitionsEnabled ? 'wait' : 'sync'}>
      <motion.div
        key={pathname}
        initial={routeTransitionsEnabled ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        exit={routeTransitionsEnabled ? { opacity: 0 } : { opacity: 1 }}
        transition={routeTransitionsEnabled ? { duration: 0.25, ease: 'easeOut' } : { duration: 0 }}
        className="h-full w-full flex flex-col"
        data-route-pathname={pathname}
        style={routeStyle}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
