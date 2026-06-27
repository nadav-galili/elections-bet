import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** Centered spinner with an optional Hebrew label. */
export function LoadingState({ label, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground',
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin" />
      {label && <p className="text-base">{label}</p>}
    </div>
  );
}
