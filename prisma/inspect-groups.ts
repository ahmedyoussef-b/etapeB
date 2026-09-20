import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const g = await prisma.group.findMany({ select: { code: true, libelle: true }, orderBy: { libelle: 'asc' } });
  console.log('total groups:', g.length);
  const byLibelle: Record<string, string[]> = {};
  for (const x of g) (byLibelle[x.libelle] = byLibelle[x.libelle] || []).push(x.code);
  console.log('--- dups by libelle ---');
  for (const k of Object.keys(byLibelle)) if (byLibelle[k].length > 1) console.log(k, '=>', byLibelle[k]);
  const byCode: Record<string, string[]> = {};
  for (const x of g) (byCode[x.code] = byCode[x.code] || []).push(x.libelle);
  console.log('--- dups by code ---');
  for (const k of Object.keys(byCode)) if (byCode[k].length > 1) console.log(k, '=>', byCode[k]);
  console.log('--- all ---');
  for (const x of g) console.log(JSON.stringify({ code: x.code, libelle: x.libelle }));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
