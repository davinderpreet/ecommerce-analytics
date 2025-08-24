import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../lib/prisma';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ api: 'running', database: 'ok', ts: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ api: 'running', database: 'error', error: e?.message || 'unknown' });
  }
}
