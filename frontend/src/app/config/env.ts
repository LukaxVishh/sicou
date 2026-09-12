const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL não foi configurada.');
}

export const env = {
  apiBaseUrl,
};