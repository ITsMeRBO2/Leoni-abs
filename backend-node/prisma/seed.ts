import { PrismaClient } from '@prisma/client';
import { hashDjangoPassword } from '../src/utils/hash';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const hashedPassword = hashDjangoPassword('adminpass');
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        email: 'admin@example.com'
      }
    });
    console.log('Seeded default admin user: admin / adminpass');
  } else {
    console.log('Database already has users, skipping seeding.');
  }

  // Seed default settings if empty
  const settingsCount = await prisma.settings.count();
  if (settingsCount === 0) {
    await prisma.settings.create({
      data: {
        id: 1,
        min_working_hours: 5.0,
        disabled_families: JSON.stringify([])
      }
    });
    console.log('Seeded default settings.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
