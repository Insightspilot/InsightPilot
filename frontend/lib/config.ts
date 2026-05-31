// Server-side only — never exposed to browser
export const config = {
  apiBaseUrl: process.env.API_URL || "http://localhost:8000/api/v1",
};
