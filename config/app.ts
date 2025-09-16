const DEFAULT_BASE_URL = 'http://localhost:3000';

const configuredBaseUrl =
  process.env.BASE_URL ||
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.API_BASE_URL ||
  '';

export const BASE_URL = configuredBaseUrl.trim() || DEFAULT_BASE_URL;
