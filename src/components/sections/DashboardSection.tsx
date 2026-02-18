import { clsx } from 'clsx';
import type { DashboardSectionProps } from '@/types';

const columnClasses = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

export function DashboardSection({ title, children, columns = 3 }: DashboardSectionProps) {
  return (
    <section className="mb-ha-6">
      <h2 className="text-lg font-semibold text-text-primary mb-ha-3 pl-1 lg:pl-2">{title}</h2>
      <div className={clsx('grid gap-ha-3 p-1 lg:p-2', columnClasses[columns])}>
        {children}
      </div>
    </section>
  );
}
