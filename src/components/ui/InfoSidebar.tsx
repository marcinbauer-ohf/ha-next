'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { mdiClose, mdiHomeAssistant, mdiGithub, mdiInformation } from '@mdi/js';

interface InfoSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function InfoSidebar({ open, onClose }: InfoSidebarProps) {
  const [visible, setVisible] = useState(false);

  // Handle open/close animations
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setVisible(true);
    } else {
      const timer = setTimeout(() => {
        setVisible(false);
        document.body.style.overflow = '';
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open && !visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`relative w-full max-w-sm bg-surface-default h-full shadow-2xl border-l border-surface-lower flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-ha-4 border-b border-surface-lower">
          <div className="flex items-center gap-ha-3">
            <div className="bg-ha-blue/10 p-ha-2 rounded-ha-lg text-ha-blue">
              <Icon path={mdiInformation} size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">About</h2>
              <p className="text-xs text-text-secondary">Dashboard Information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-ha-2 rounded-full hover:bg-surface-low text-text-secondary transition-colors"
          >
            <Icon path={mdiClose} size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-ha-4 space-y-ha-6">
          
          {/* App Info */}
          <div className="bg-surface-low rounded-ha-xl p-ha-4 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-surface-default rounded-full flex items-center justify-center mb-ha-3 shadow-sm">
                <Icon path={mdiHomeAssistant} size={40} className="text-ha-blue" />
            </div>
            <h3 className="text-lg font-medium text-text-primary">Note HA</h3>
            <p className="text-sm text-text-secondary mb-ha-3">Next Generation Dashboard</p>
            <span className="px-ha-3 py-ha-1 bg-fill-primary-quiet text-ha-blue text-xs font-medium rounded-full">
              v2.0.0-beta
            </span>
          </div>

          {/* Details List */}
          <div className="space-y-ha-4">
            <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">System</h4>
            
            <div className="space-y-ha-2">
              <div className="flex justify-between items-center py-ha-2 border-b border-surface-lower last:border-0">
                <span className="text-sm text-text-secondary">Framework</span>
                <span className="text-sm font-medium text-text-primary">Next.js 14</span>
              </div>
              <div className="flex justify-between items-center py-ha-2 border-b border-surface-lower last:border-0">
                <span className="text-sm text-text-secondary">Environment</span>
                <span className="text-sm font-medium text-text-primary">Production</span>
              </div>
              <div className="flex justify-between items-center py-ha-2 border-b border-surface-lower last:border-0">
                <span className="text-sm text-text-secondary">Status</span>
                <span className="text-sm font-medium text-green-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Connected
                </span>
              </div>
            </div>
          </div>

          {/* Credits */}
          <div className="space-y-ha-4">
            <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Credits</h4>
            <div className="bg-surface-lower rounded-ha-lg p-ha-3 text-sm text-text-secondary leading-relaxed">
              Designed with focus on aesthetics and performance. Leveraging the latest web technologies to provide a seamless smart home experience.
            </div>
            
            <a 
              href="https://github.com/home-assistant" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-ha-3 p-ha-3 rounded-ha-xl hover:bg-surface-low transition-colors group"
            >
              <Icon path={mdiGithub} size={24} className="text-text-primary group-hover:text-black dark:group-hover:text-white transition-colors" />
              <div className="flex-1">
                <div className="text-sm font-medium text-text-primary">Home Assistant</div>
                <div className="text-xs text-text-tertiary">Open source home automation</div>
              </div>
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="p-ha-4 border-t border-surface-lower bg-surface-low/50">
          <p className="text-xs text-center text-text-tertiary">
            &copy; 2026 Home Assistant User
          </p>
        </div>
      </div>
    </div>
  );
}
