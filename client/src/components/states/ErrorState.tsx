import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** Centered error state with destructive styling and an optional retry button. */
export function ErrorState({
  title = 'משהו השתבש',
  description,
  onRetry,
  retryLabel = 'נסו שוב',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center text-destructive',
        className,
      )}
    >
      <AlertCircle className="size-8" />
      <p className="text-lg font-semibold">{title}</p>
      {description && <p className="text-lg text-destructive/80">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="lg" onClick={onRetry} className="mt-2">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
