import { Captions, Gauge, Scissors, Sparkles, Wand2, Smartphone } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const features = [
  {
    icon: Wand2,
    title: 'AI Highlight Detection',
    description:
      'Finds your most engaging moments using sentiment spikes, emphasis, pauses, and topic shifts — not just keyword matching.',
  },
  {
    icon: Scissors,
    title: 'Automatic Clip Generation',
    description:
      'FFmpeg-powered cutting produces 15–90 second clips, reframed to 9:16, 1:1, or 16:9 for any platform.',
  },
  {
    icon: Captions,
    title: 'Word-by-Word Captions',
    description:
      'Styled, animated captions with keyword highlighting and emoji enhancement — burned in or exported as SRT.',
  },
  {
    icon: Gauge,
    title: 'Virality Score',
    description:
      'Each clip gets a 0–100 score predicting performance, plus hook titles, descriptions, and hashtags.',
  },
  {
    icon: Smartphone,
    title: 'Multi-Platform Export',
    description:
      'Optimized exports for TikTok, Instagram Reels, and YouTube Shorts — with or without watermark.',
  },
  {
    icon: Sparkles,
    title: 'Niche Modes',
    description:
      'Podcast, coaching, and storytelling modes tune highlight detection and captions to your content style.',
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to go viral
        </h2>
        <p className="mt-4 text-muted-foreground">
          From raw footage to publish-ready clips — ClipForge AI handles the entire repurposing
          pipeline.
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="group transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
          >
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                <feature.icon className="h-5 w-5" />
              </div>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
