'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useImmersiveMode } from '@/hooks';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { immersiveMode, immersivePhase } = useImmersiveMode();
  const routeStyle = immersiveMode ? { transform: 'none', filter: 'none' } : undefined;

  if (immersivePhase !== 'normal') {
    return (
      <div
        className="h-full w-full flex flex-col"
        data-route-pathname={pathname}
        style={routeStyle}
      >
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="h-full w-full flex flex-col"
        data-route-pathname={pathname}
        style={routeStyle}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
