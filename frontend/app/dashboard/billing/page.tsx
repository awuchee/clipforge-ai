'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const limits: Record<string, number | null> = {
  FREE: 3,
  PRO: null,
  AGENCY: null,
};

export default function BillingPage() {
  return (
    <React.Suspense fallback={null}>
      <BillingPageContent />
    </React.Suspense>
  );
}

function BillingPageContent() {
  const { user, token, refreshUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = React.useState(false);

  const plan = user?.plan ?? 'FREE';
  const limit = limits[plan];

  React.useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      refreshUser().catch(() => undefined);
      toast({ title: 'Subscription updated', description: 'Your Pro plan is now active.', variant: 'success' });
    } else if (checkout === 'cancelled') {
      toast({ title: 'Checkout cancelled', description: 'No changes were made to your subscription.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCheckout = async () => {
    setIsLoading(true);
    try {
      const { url } = await apiFetch<{ url: string }>('/billing/checkout', { method: 'POST', token });
      window.location.href = url;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not start checkout';
      toast({ title: 'Could not start checkout', description: message, variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const openPortal = async () => {
    setIsLoading(true);
    try {
      const { url } = await apiFetch<{ url: string }>('/billing/portal', { method: 'POST', token });
      window.location.href = url;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not open billing portal';
      toast({ title: 'Could not open billing portal', description: message, variant: 'destructive' });
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Current plan
            <Badge variant="secondary">{plan}</Badge>
          </CardTitle>
          <CardDescription>
            {user?.videosUsedThisMonth ?? 0} / {limit ?? '∞'} videos used this month
            {plan === 'FREE' && ' · watermarked exports'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plan === 'FREE' ? (
            <div className="space-y-2">
              <Button onClick={startCheckout} disabled={isLoading}>
                {isLoading ? 'Redirecting...' : 'Upgrade to Pro'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Unlimited uploads, no watermark, and priority processing for $29/mo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Button onClick={openPortal} disabled={isLoading}>
                {isLoading ? 'Redirecting...' : 'Manage subscription'}
              </Button>
              {user?.subscriptionStatus && (
                <p className="text-xs text-muted-foreground">Status: {user.subscriptionStatus}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
