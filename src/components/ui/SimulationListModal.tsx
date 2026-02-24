'use client';

import { Icon } from '@/components/ui/Icon';
import { mdiClose, mdiDelete } from '@mdi/js';

interface SimulationListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: { id: string; name: string; state: string }[];
  onRemove: (id: string) => void;
}

export function SimulationListModal({ isOpen, onClose, title, items, onRemove }: SimulationListModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative bg-surface-default rounded-ha-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-ha-4 border-b border-surface-lower bg-surface-low/30">
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          <button 
            onClick={onClose}
            className="p-ha-2 rounded-full hover:bg-surface-low text-text-secondary transition-colors"
          >
            <Icon path={mdiClose} size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto p-ha-4 space-y-ha-3">
          {items.length === 0 ? (
            <div className="text-center text-text-secondary py-8">No active simulations</div>
          ) : (
            items.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-ha-3 bg-surface-low rounded-ha-xl border border-surface-lower"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-text-primary truncate">{item.name}</span>
                  <span className="text-xs text-text-secondary truncate font-mono">{item.id}</span>
                  <span className="text-xs text-text-tertiary mt-1">{item.state}</span>
                </div>
                <button
                  onClick={() => onRemove(item.id)}
                  className="p-ha-2 text-red-500 hover:bg-red-500/10 rounded-ha-lg transition-colors ml-3"
                  title="Remove"
                >
                  <Icon path={mdiDelete} size={20} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
