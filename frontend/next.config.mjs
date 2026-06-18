/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Strip any localhost value Vercel dashboard injects before it gets
    // baked into the static bundle. next.config env is processed after
    // system env in DefinePlugin — this replaces the wrong value at build time.
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL &&
      !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
        ? process.env.NEXT_PUBLIC_API_URL
        : 'https://clipforge-ai-5afc.onrender.com/api',
  },
};

export default nextConfig;
