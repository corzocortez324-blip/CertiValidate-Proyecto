process.env.NODE_ENV = process.env.NODE_ENV || 'test'
require('../src/utils/load-env')
const prisma = require('../src/utils/prisma')

module.exports = async () => {
  await prisma.$disconnect()
}
