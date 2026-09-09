import { PrismaClient } from '@prisma/client'
import { seedApp } from '../lib/seed-app'

const prisma = new PrismaClient()

seedApp(prisma)
  .then(() => console.log('Ghost Mail Finder seed completed'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
