'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';

export function UpgradeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>You&apos;ve hit the Free plan limit</DialogTitle>
          <DialogDescription>
            Free accounts can process up to 3 videos per month with watermarked exports. Upgrade to Pro for
            unlimited uploads, no watermark, and priority processing.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button onClick={startCheckout} disabled={isLoading}>
            {isLoading ? 'Redirecting...' : 'Upgrade to Pro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
