require('dotenv').config({ path: '.env' })
const prisma = require('../src/utils/prisma')

module.exports = async () => {
  await prisma.$disconnect()
}