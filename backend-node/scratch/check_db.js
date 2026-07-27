const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users in database:', users.map(u => ({ id: u.id, username: u.username, role: u.role, email: u.email })));
  const settings = await prisma.settings.findMany();
  console.log('Settings in database:', settings);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
