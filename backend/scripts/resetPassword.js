/**
 * iSysware HRMS — Interactive CLI Password Reset Utility
 * Allows administrators to securely reset account passwords directly via terminal.
 * Features:
 * - Interactive masked or direct terminal input
 * - Argon2id secure password hashing
 * - Automatic revocation of existing user sessions
 * - Zero exposure of raw passwords in logs, history, or responses
 */

import readline from 'readline'
import argon2 from 'argon2'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
}

function askQuestion(rl, query, isPassword = false) {
  return new Promise((resolve) => {
    if (!isPassword) {
      rl.question(query, (answer) => resolve(answer.trim()))
      return
    }

    // Masked password input
    process.stdout.write(query)
    const stdin = process.stdin
    const wasRaw = stdin.isRaw

    if (stdin.isTTY) {
      stdin.setRawMode(true)
    }
    stdin.resume()

    let password = ''

    const onData = (chunk) => {
      const char = chunk.toString('utf8')
      for (const c of char) {
        if (c === '\n' || c === '\r' || c === '\u0004') {
          if (stdin.isTTY) stdin.setRawMode(wasRaw)
          stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(password.trim())
          return
        } else if (c === '\u0003') {
          // Ctrl+C
          if (stdin.isTTY) stdin.setRawMode(wasRaw)
          stdin.removeListener('data', onData)
          process.stdout.write('\n')
          process.exit(1)
        } else if (c === '\b' || c === '\x7f') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1)
            process.stdout.write('\b \b')
          }
        } else {
          password += c
          process.stdout.write('*')
        }
      }
    }

    stdin.on('data', onData)
  })
}

async function main() {
  console.log('\n========================================================')
  console.log('   iSysware HRMS — Secure CLI Password Reset Utility')
  console.log('========================================================\n')

  const rl = createInterface()

  try {
    const targetInput = await askQuestion(rl, 'Enter Username or Email [default: superadmin]: ')
    const identifier = targetInput || 'superadmin'

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier.toLowerCase() }
        ]
      }
    })

    if (!user) {
      console.error(`\n[ERROR] No account found matching "${identifier}".`)
      process.exit(1)
    }

    console.log(`\nFound Account: ${user.username} (${user.email})`)
    console.log(`Role: ${user.role} | Protected: ${user.isProtected} | Active: ${user.isActive}\n`)

    const newPassword = await askQuestion(rl, 'Enter New Password: ', true)
    if (!newPassword || newPassword.length < 6) {
      console.error('\n[ERROR] Password must be at least 6 characters long.')
      process.exit(1)
    }

    const confirmPassword = await askQuestion(rl, 'Confirm New Password: ', true)
    if (newPassword !== confirmPassword) {
      console.error('\n[ERROR] Passwords do not match. Reset aborted.')
      process.exit(1)
    }

    console.log('\nHashing password with Argon2id...')
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    })

    console.log('Updating database...')
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date()
      }
    })

    // Revoke all active sessions for this user
    const revoked = await prisma.session.deleteMany({
      where: { userId: user.id }
    })

    console.log(`\n[SUCCESS] Password updated successfully for ${user.username} (${user.email}).`)
    console.log(`[SECURITY] ${revoked.count} active session(s) revoked. Account status preserved.`)
    console.log('\nYou can now log in at http://localhost:5173/login\n')
  } catch (err) {
    console.error('\n[ERROR] Failed to reset password:', err.message)
    process.exit(1)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

main()

