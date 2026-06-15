import { LandingNavbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Pricing } from '@/components/landing/pricing';
import { Testimonials } from '@/components/landing/testimonials';
import { LandingFooter } from '@/components/landing/footer';

export default function LandingPage() {
  return (
    <main>
      <LandingNavbar />
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />
      <LandingFooter />
    </main>
  );
}
