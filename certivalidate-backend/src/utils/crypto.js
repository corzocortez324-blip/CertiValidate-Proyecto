const crypto = require('crypto')
const { getEnv } = require('./env')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

const getKey = () => {
  const secret = getEnv('ENCRYPTION_KEY')
  const buf = Buffer.from(secret, 'hex')
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser 64 caracteres hexadecimales (32 bytes)')
  }
  return buf
}

const encrypt = (text) => {
  if (!text) return null
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

const decrypt = (stored) => {
  if (!stored) return null
  const [ivHex, tagHex, cipherHex] = stored.split(':')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(cipherHex, 'hex')) + decipher.final('utf8')
}

module.exports = { encrypt, decrypt }
