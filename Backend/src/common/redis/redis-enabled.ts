import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const readRedisUrlFromEnvFile = () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return undefined;

  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith('REDIS_URL='));

  if (!line) return undefined;
  return line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^['"]|['"]$/g, '');
};

export const getRedisUrl = () => process.env.REDIS_URL?.trim() || readRedisUrlFromEnvFile();

export const isRedisEnabled = () => Boolean(getRedisUrl());
