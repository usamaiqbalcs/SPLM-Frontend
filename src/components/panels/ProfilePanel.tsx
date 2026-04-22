import { useAuth } from '@/contexts/AuthContext';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProfilePanel() {
  const { profile, userRole, user } = useAuth();

  return (
    <div className="min-h-0 min-w-0 space-y-4 animate-fade-in">
      <SplmPageHeader
        title="Profile"
        subtitle="Your signed-in account and application role."
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Details from your session and server profile.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Display name</p>
            <p className="text-sm font-medium text-foreground">{profile?.name ?? user?.name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
            <p className="text-sm font-medium text-foreground break-all">{profile?.email ?? user?.email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Application role</p>
            <Badge variant="secondary" className="w-fit capitalize">
              {userRole || '—'}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="text-sm font-medium text-foreground">
              {profile?.active === false ? (
                <span className="text-muted-foreground">Inactive</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">Active</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
