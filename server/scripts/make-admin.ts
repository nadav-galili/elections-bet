// Promote a user to SUPER_ADMIN by email or Clerk id.
//   bun run --filter server db:make-admin -- <email-or-clerkId>
// or directly: tsx --env-file=.env scripts/make-admin.ts <email-or-clerkId>
import { prisma } from '../src/db';

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: db:make-admin <email-or-clerkId>');
    process.exitCode = 1;
    return;
  }

  const { count } = await prisma.user.updateMany({
    where: { OR: [{ email: arg }, { clerkId: arg }] },
    data: { role: 'SUPER_ADMIN' },
  });

  if (count === 0) {
    console.log(
      `No user matched "${arg}". The user must sign in once first so the Clerk webhook mirrors them into the database, then run this again.`,
    );
  } else {
    console.log(`Promoted ${count} user(s) matching "${arg}" to SUPER_ADMIN.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
