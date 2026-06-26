import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

/** Unauthenticated client for public endpoints (e.g. health). */
export const api = axios.create({ baseURL });

/**
 * Authenticated Axios instance that attaches the current Clerk session token
 * as a Bearer header on every request. Use inside components/hooks.
 */
export function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => {
    const instance = axios.create({ baseURL });
    instance.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return instance;
  }, [getToken]);
}
