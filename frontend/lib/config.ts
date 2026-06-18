export const PRODUCTION_API_URL = 'https://clipforge-ai-5afc.onrender.com/api';

export const API_BASE_URL =
  process.env.NODE_ENV === 'development'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api')
    : PRODUCTION_API_URL;
