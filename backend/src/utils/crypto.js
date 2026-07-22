const { createHash } = require('crypto')
const bcrypt = require('bcryptjs')

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

async function hashBcrypt(password) {
  return bcrypt.hash(password, 10)
}

async function verifyPassword(plainPassword, storedHash, method = 'bcrypt') {
  if (method === 'sha256') {
    return sha256(plainPassword) === storedHash
  }
  return bcrypt.compare(plainPassword, storedHash)
}

module.exports = { sha256, hashBcrypt, verifyPassword }
