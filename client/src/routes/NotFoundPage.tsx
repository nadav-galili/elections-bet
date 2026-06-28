import { Compass, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDarkSurface } from '@/components/candy/useDarkSurface';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';

/** Catch-all 404 page: a centered Hebrew message with a link back home. */
export default function NotFoundPage() {
  useDarkSurface();
  return (
    <div className="theme-candy">
      <EmptyState
        icon={Compass}
        title="הדף לא נמצא"
        description="הקישור שגוי או שהדף הוסר."
        action={
          <Button asChild size="lg">
            <Link to="/">
              <Home className="size-4" />
              חזרה לדף הבית
            </Link>
          </Button>
        }
      />
    </div>
  );
}
