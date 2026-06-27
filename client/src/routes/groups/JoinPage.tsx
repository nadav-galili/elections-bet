import { AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SignInButton, useAuth } from '@clerk/react';
import { useJoinGroup } from '@/lib/groups/hooks';
import { Button } from '@/components/ui/button';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const joinGroup = useJoinGroup();
  const joinMutate = joinGroup.mutate;
  const attempted = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !token || attempted.current) return;
    attempted.current = true;
    joinMutate(token, {
      onSuccess: (group) => {
        navigate(`/groups/${group.id}`);
      },
    });
  }, [isLoaded, isSignedIn, token, joinMutate, navigate]);

  // Clerk still resolving the session.
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  // Signed out — prompt for sign-in, then the effect will run on next render.
  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-xl font-extrabold tracking-tight">הצטרפות לקבוצה</h1>
        <p className="text-muted-foreground">יש להתחבר כדי להצטרף לקבוצה.</p>
        <SignInButton mode="modal">
          <Button>התחברות</Button>
        </SignInButton>
      </div>
    );
  }

  // Join failed.
  if (joinGroup.isError) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <div className="flex items-center justify-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-4" />
          ההצטרפות לקבוצה נכשלה. ייתכן שהקישור אינו תקין.
        </div>
        <Button asChild variant="outline">
          <Link to="/groups">חזרה לקבוצות</Link>
        </Button>
      </div>
    );
  }

  // Signed in and joining.
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <Loader2 className="mx-auto size-6 animate-spin" />
        <p className="mt-4 text-lg">מצטרף לקבוצה...</p>
      </div>
    </div>
  );
}
