import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Load backend/.env by absolute path. Under IIS/iisnode the working directory
// is not the backend folder, so a bare `import 'dotenv/config'` can miss it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// All configuration comes from environment variables — nothing here is
// hardcoded. DATABASE_URL is required: the project is connected to the
// live Azure PostgreSQL instance (see backend/.env), and src/config/prisma.js
// touches it at startup via the /api/health/db check.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // PORT is normally a number (e.g. 4000), but iisnode passes a named pipe
  // string (e.g. \\.\pipe\abc-123). Numeric strings become numbers; anything
  // else (a pipe name) is passed through unchanged for app.listen().
  PORT: z
    .string()
    .default('4000')
    .transform((value) => (/^\d+$/.test(value) ? Number(value) : value)),

  // Comma-separated list of allowed frontend origins, e.g.
  // "http://localhost:5173,https://nexora-pos.azurestaticapps.net". This lets
  // the same backend serve the local Vite dev server AND the deployed Azure
  // Static Web App (and any preview/staging SWA URLs) without code changes —
  // just add the origin to the env var. Use "*" to allow any origin (no
  // credentials will be reflected back in that case, per the CORS spec).
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be set in .env (see .env.example) and be at least 16 characters'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL must be set in .env (see .env.example)'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Fix the environment variables in backend/.env (see .env.example) before starting the server.');
}

export const env = parsed.data;

// Parsed allowlist derived from CORS_ORIGIN — trimmed, empty entries
// dropped, so "http://a, http://b ,,http://c" all work.
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);