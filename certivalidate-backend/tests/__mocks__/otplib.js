'use strict'

// CJS mock of otplib for Jest.
// otplib@13 pulls in @scure/base and @noble/hashes which are pure ESM.
// Jest's synchronous require can't load ESM modules (even on Node 24 which supports require(esm)).
// This mock implements real RFC 6238 TOTP using Node's built-in crypto — no new dependencies.

const crypto = require('crypto')

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf) {
  let bits = 0, value = 0, out = ''
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5) { out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  while (out.length % 8 !== 0) out += '='
  return out
}

function base32Decode(str) {
  const s = str.toUpperCase().replace(/=+$/, '')
  let bits = 0, value = 0
  const out = []
  for (let i = 0; i < s.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(s[i])
    if (idx === -1) throw new Error(`Invalid base32 char: ${s[i]}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

function hotp(secretBuf, counter) {
  const counterBuf = Buffer.alloc(8)
  const hi = Math.floor(counter / 0x100000000)
  const lo = counter >>> 0
  counterBuf.writeUInt32BE(hi, 0)
  counterBuf.writeUInt32BE(lo, 4)
  const hmac = crypto.createHmac('sha1', secretBuf).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff)
  return String(code % 1000000).padStart(6, '0')
}

function totpCounter(period = 30) {
  return Math.floor(Date.now() / 1000 / period)
}

const generateSecret = () => base32Encode(crypto.randomBytes(20))

const generateSync = (secret) => {
  const secretBuf = base32Decode(secret)
  return hotp(secretBuf, totpCounter())
}

const verifySync = ({ secret, token }) => {
  const secretBuf = base32Decode(secret)
  const t = totpCounter()
  // Allow ±1 time step for clock drift
  for (const delta of [-1, 0, 1]) {
    if (hotp(secretBuf, t + delta) === String(token)) return { valid: true }
  }
  return { valid: false }
}

const generateURI = ({ issuer, label, secret }) =>
  `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`

module.exports = { generateSecret, generateSync, verifySync, generateURI }
