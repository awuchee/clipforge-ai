import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          ClipForge AI
        </Link>
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} ClipForge AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
