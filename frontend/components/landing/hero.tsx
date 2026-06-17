'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Flame, PlayCircle, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DEMO_CAPTION_WORDS = ['THIS', 'is', 'the', 'EXACT', 'moment', 'everything', 'changed'];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent"
        aria-hidden
      />
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="secondary" className="mb-6">
            New: AI Virality Score &amp; Niche Modes
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
        >
          Turn long videos into{' '}
          <span className="bg-gradient-to-r from-primary to-fuchsia-400 bg-clip-text text-transparent">
            viral short clips
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-2xl text-lg text-muted-foreground"
        >
          Drop in a YouTube link, video file, or podcast — VixClip AI finds the highlights,
          cuts vertical clips, writes hooks, and adds styled captions automatically.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >
          <Button size="lg" asChild>
            <Link href="/register">
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#demo">
              <PlayCircle className="h-4 w-4" />
              Watch demo
            </Link>
          </Button>
        </motion.div>

        <motion.div
          id="demo"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 w-full"
        >
          <div className="relative flex w-full flex-col items-center justify-center gap-8 rounded-2xl border border-border bg-card/60 px-6 py-12 shadow-2xl shadow-primary/10 sm:flex-row sm:gap-12">
            {/* ambient glow */}
            <div
              className="absolute inset-0 -z-10 rounded-2xl bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"
              aria-hidden
            />

            {/* Phone mock with simulated 9:16 clip preview */}
            <div className="relative aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-[1.5rem] border border-border/80 bg-black shadow-xl">
              {/* fake video background */}
              <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/30 via-primary/30 to-indigo-900/60" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,_rgba(255,255,255,0.18),_transparent_55%)]" />

              {/* virality score badge */}
              <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
                <Flame className="h-3 w-3 text-orange-400" />
                94
              </div>

              {/* hook title overlay */}
              <div className="absolute inset-x-0 top-8 px-3 text-center">
                <p className="text-sm font-extrabold uppercase leading-tight text-white drop-shadow-md">
                  I tried this for 30 days...
                </p>
              </div>

              {/* play icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                  <PlayCircle className="h-7 w-7 text-white" />
                </div>
              </div>

              {/* word-by-word captions */}
              <div className="absolute inset-x-0 bottom-10 flex flex-wrap items-center justify-center gap-1 px-3">
                {DEMO_CAPTION_WORDS.map((word, i) => (
                  <motion.span
                    key={word + i}
                    initial={{ opacity: 0.35, scale: 0.92 }}
                    animate={{ opacity: [0.35, 1, 0.35], scale: [0.92, 1.08, 0.92] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
                    className="rounded bg-black/40 px-1.5 py-0.5 text-[11px] font-extrabold uppercase text-white"
                    style={word === word.toUpperCase() && word.length > 2 ? { color: 'hsl(var(--primary))' } : undefined}
                  >
                    {word}
                  </motion.span>
                ))}
              </div>

              {/* progress bar */}
              <div className="absolute inset-x-3 bottom-4 h-1 overflow-hidden rounded-full bg-white/20">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: '0%' }}
                  animate={{ width: '70%' }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                />
              </div>
            </div>

            {/* feature highlights next to the phone */}
            <div className="flex max-w-sm flex-col gap-4 text-left">
              <h3 className="text-xl font-semibold">From raw footage to ready-to-post clips</h3>
              <p className="text-sm text-muted-foreground">
                VixClip AI automatically finds your best moments, reframes them to 9:16, and adds
                animated captions, hooks, and a virality score — all in one pass.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm">Animated, word-by-word captions</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
                  <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm">Virality score for every clip</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
                  <Flame className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm">10 hook title variations per clip</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
