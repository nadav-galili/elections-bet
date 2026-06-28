import { useEffect, useRef } from 'react';
import { ArrowRight, LogIn } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SignInButton, useAuth } from '@clerk/react';
import { useJoinGroup } from '@/lib/groups/hooks';
import { useDarkSurface } from '@/components/candy/useDarkSurface';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/states';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  useDarkSurface();
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
    return <LoadingState label="בודק חיבור…" />;
  }

  // Signed out — prompt for sign-in, then the effect will run on next render.
  if (!isSignedIn) {
    return (
      <div className="theme-candy mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">הצטרפות לקבוצה</h1>
        <p className="text-muted-foreground">יש להתחבר כדי להצטרף לקבוצה.</p>
        <SignInButton mode="modal">
          <Button>
            <LogIn className="size-4" />
            התחברות
          </Button>
        </SignInButton>
      </div>
    );
  }

  // Join failed.
  if (joinGroup.isError) {
    return (
      <div className="theme-candy mx-auto max-w-md space-y-4 py-16">
        <ErrorState
          title="ההצטרפות לקבוצה נכשלה"
          description="ייתכן שהקישור אינו תקין או שפג תוקפו."
        />
        <div className="text-center">
          <Button asChild variant="outline">
            <Link to="/groups">
              <ArrowRight className="size-4" />
              חזרה לקבוצות
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Signed in and joining.
  return <LoadingState label="מצטרף לקבוצה…" />;
}
