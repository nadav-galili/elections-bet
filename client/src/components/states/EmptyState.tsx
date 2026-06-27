import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Centered, muted empty state with an optional icon, description, and action. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-muted-foreground',
        className,
      )}
    >
      {Icon && <Icon className="size-10 opacity-60" />}
      <p className="text-lg font-semibold text-foreground">{title}</p>
      {description && <p className="text-lg">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
