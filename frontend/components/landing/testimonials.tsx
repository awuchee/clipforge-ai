import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const testimonials = [
  {
    name: 'Maya Chen',
    role: 'Podcast host, 180K subs',
    quote:
      "VixClip found moments in my 90-minute episodes I would've scrolled right past. My Shorts views tripled.",
  },
  {
    name: 'Jordan Lee',
    role: 'Business coach',
    quote:
      'Coaching mode + the virality score basically gives me a content calendar every week from a single recording.',
  },
  {
    name: 'Priya Nair',
    role: 'Creator & streamer',
    quote:
      'The caption styling alone saved me hours per video. Auto reframing to 9:16 looks better than what I was doing manually.',
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Loved by creators</h2>
        <p className="mt-4 text-muted-foreground">
          Join thousands of creators using VixClip AI to grow their audience.
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <Card key={t.name}>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <Avatar>
                <AvatarFallback>{t.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
