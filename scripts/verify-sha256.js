#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const crypto = require('crypto')
const fs = require('fs')

/**
 * Verify SHA-256 checksum of a downloaded file.
 * When expectedHash is null the check is skipped with a warning so that
 * developers can populate hashes incrementally.
 * @param {string} filePath - Path to the file to verify
 * @param {string|null} expectedHash - Expected SHA-256 hex digest, or null to skip
 * @returns {boolean} True if hash matches or no hash provided
 */
function verifySha256(filePath, expectedHash) {
  const fileBuffer = fs.readFileSync(filePath)
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
  console.log(`SHA-256: ${hash}`)

  if (!expectedHash) {
    console.warn(
      '⚠️  No expected checksum configured for this binary. Populate the sha256 field in PLATFORM_CONFIG after verifying this hash on a trusted machine.'
    )
    return true
  }

  if (hash !== expectedHash) {
    console.error(`❌ Checksum mismatch! Expected ${expectedHash} but got ${hash}`)
    return false
  }

  console.log('✅ Checksum verified.')
  return true
}

module.exports = { verifySha256 }
