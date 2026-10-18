export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5050',
  VERSION: '/api/v1',
} as const;

export const FULL_API_URL = `${API_CONFIG.BASE_URL}${API_CONFIG.VERSION}`;
