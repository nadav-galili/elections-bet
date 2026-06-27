import { prisma } from '../src/db';

// Standard 25th-Knesset (2022) lineup, used as the starting party list for a
// new election. Bloc convention: A = right-religious bloc, B = center-left /
// "change" bloc, UNALIGNED = Arab parties. Logos are stable Wikimedia Commons
// Special:FilePath URLs (each verified to return an image). Edit in /admin.
const PARTIES = [
  {
    nameHe: 'הליכוד',
    bloc: 'A',
    displayOrder: 1,
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Likud%20Logo.svg',
  },
  {
    nameHe: 'יש עתיד',
    bloc: 'B',
    displayOrder: 2,
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/YeshAtidLogo.svg',
  },
  {
    nameHe: 'הציונות הדתית',
    bloc: 'A',
    displayOrder: 3,
    logoUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Parti%20sioniste%20religieux%20logo%202022.png',
  },
  {
    nameHe: 'המחנה הממלכתי',
    bloc: 'B',
    displayOrder: 4,
    logoUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/National%20Unity%20Party%20%28Israel%29%20August%202022.svg',
  },
  {
    nameHe: 'ש"ס',
    bloc: 'A',
    displayOrder: 5,
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Shas%20logo.png',
  },
  {
    nameHe: 'יהדות התורה',
    bloc: 'A',
    displayOrder: 6,
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Yahadut%20HaTorah%20logo.png',
  },
  {
    nameHe: 'ישראל ביתנו',
    bloc: 'B',
    displayOrder: 7,
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Israel-beytenu-logo.svg',
  },
  {
    nameHe: 'רע"ם',
    bloc: 'UNALIGNED',
    displayOrder: 8,
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Raam%20logo%202021.svg',
  },
  {
    nameHe: 'חד"ש-תע"ל',
    bloc: 'UNALIGNED',
    displayOrder: 9,
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Logo%20Hadash%20Ta%27al.png',
  },
  {
    nameHe: 'העבודה',
    bloc: 'B',
    displayOrder: 10,
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/HaAvoda%20Logo.svg',
  },
] as const;

async function main() {
  const electionId = process.argv[2];
  const election = electionId
    ? await prisma.election.findUnique({ where: { id: electionId } })
    : await prisma.election.findFirst({ orderBy: { createdAt: 'desc' } });

  if (!election) {
    console.error(
      'No election found. Pass an election id, or create one in /admin first:\n' +
        '  bun run --filter server db:seed-parties <electionId>',
    );
    process.exit(1);
    return;
  }

  console.log(`Seeding parties into "${election.nameHe}" (${election.id})`);

  let created = 0;
  let updated = 0;
  for (const p of PARTIES) {
    // No (electionId, nameHe) unique constraint, so match by name then
    // create-or-update — keeps the script safe to re-run (backfills logos).
    const existing = await prisma.party.findFirst({
      where: { electionId: election.id, nameHe: p.nameHe },
    });
    const data = {
      nameHe: p.nameHe,
      bloc: p.bloc,
      displayOrder: p.displayOrder,
      logoUrl: p.logoUrl,
    };
    if (existing) {
      await prisma.party.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.party.create({
        data: { ...data, electionId: election.id },
      });
      created++;
    }
  }

  console.log(`Done. Created ${created}, updated ${updated}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
