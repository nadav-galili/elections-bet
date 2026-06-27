import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';

/** Catch-all 404 page: a centered Hebrew message with a link back home. */
export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="הדף לא נמצא"
      description="הקישור שגוי או שהדף הוסר."
      action={
        <Button asChild size="lg">
          <Link to="/">חזרה לדף הבית</Link>
        </Button>
      }
    />
  );
}
