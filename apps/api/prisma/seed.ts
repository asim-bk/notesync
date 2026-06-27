import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createId } from "../src/lib/id";
import { hashSecret, normalizeEmail } from "../src/lib/security";

const prisma = new PrismaClient();

async function main() {
  const email = normalizeEmail(process.env.SEED_DEMO_EMAIL ?? "demo@notesync.local");
  const password = process.env.SEED_DEMO_PASSWORD ?? "DemoPass123!";
  const displayName = process.env.SEED_DEMO_NAME ?? "Demo User";

  await prisma.user.upsert({
    where: { email },
    update: {
      displayName
    },
    create: {
      id: createId(),
      email,
      displayName,
      passwordHash: hashSecret(password)
    }
  });

  console.log(`Seeded demo user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
