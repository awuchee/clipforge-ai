'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Try VixClip AI on a few videos.',
    features: ['3 videos / month', 'Auto captions', 'Watermarked exports', 'Standard highlight detection'],
    cta: 'Start for free',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For creators publishing consistently.',
    features: [
      'Unlimited videos',
      'No watermark',
      'Virality score & hook titles',
      'Niche modes',
      'Priority processing',
    ],
    cta: 'Upgrade to Pro',
    href: '/register?plan=pro',
    highlighted: true,
  },
  {
    name: 'Agency',
    price: '$99',
    period: '/mo',
    description: 'For teams and agencies at scale.',
    features: [
      'Unlimited videos',
      'Team seats',
      'Bulk export (ZIP)',
      'Direct social publishing',
      'Dedicated support',
    ],
    cta: 'Contact sales',
    href: '/register?plan=agency',
    highlighted: false,
  },
];

export function Pricing() {
  const { token } = useAuth();
  const router = useRouter();
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
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
        <p className="mt-4 text-muted-foreground">Start free. Upgrade when you&apos;re ready to scale.</p>
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              'flex flex-col transition-all duration-200 hover:-translate-y-1',
              plan.highlighted
                ? 'border-primary shadow-lg shadow-primary/20 hover:shadow-primary/30'
                : 'hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5',
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {plan.name}
                {plan.highlighted && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Most popular
                  </span>
                )}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {plan.name === 'Pro' && token ? (
                <Button
                  className="w-full"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  disabled={isLoading}
                  onClick={startCheckout}
                >
                  {isLoading ? 'Redirecting...' : plan.cta}
                </Button>
              ) : plan.name === 'Pro' ? (
                <Button
                  className="w-full"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  onClick={() => router.push('/register?plan=pro')}
                >
                  {plan.cta}
                </Button>
              ) : (
                <Button asChild className="w-full" variant={plan.highlighted ? 'default' : 'outline'}>
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
