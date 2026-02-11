/**
 * Reset Supabase Auth + Prisma users, then create exactly two users (OTP-only):
 * 1. vantage_admin: nasir.saqib1@gmail.com
 * 2. practice_admin: support@getvantage.tech (with a default practice)
 *
 * Run: tsx scripts/reset-auth-and-seed-otp-users.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 */

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

const VANTAGE_ADMIN_EMAIL = 'nasir.saqib1@gmail.com'
const VANTAGE_ADMIN_NAME = 'Vantage Admin'
const PRACTICE_ADMIN_EMAIL = 'support@getvantage.tech'
const PRACTICE_ADMIN_NAME = 'Support'
const DEFAULT_PRACTICE_NAME = 'Vantage Practice'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('1. Deleting all Supabase Auth users...')
  let totalDeleted = 0
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('listUsers error:', error.message)
      process.exit(1)
    }
    const users = data?.users ?? []
    if (users.length === 0) break
    for (const u of users) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id)
      if (delErr) console.warn(`  Could not delete ${u.email}:`, delErr.message)
      else {
        totalDeleted++
        if (totalDeleted <= 10) console.log(`  Deleted: ${u.email}`)
      }
    }
    if (users.length < perPage) break
    page++
  }
  if (totalDeleted > 10) console.log(`  ... and ${totalDeleted - 10} more`)
  console.log(`  Total Supabase users deleted: ${totalDeleted}`)

  console.log('\n2. Deleting all Prisma users...')
  const deletedUsers = await prisma.user.deleteMany({})
  console.log(`  Deleted ${deletedUsers.count} Prisma users`)

  console.log('\n3. Ensuring default practice exists...')
  let practice = await prisma.practice.findFirst({ where: { name: DEFAULT_PRACTICE_NAME } })
  if (!practice) {
    practice = await prisma.practice.create({
      data: { name: DEFAULT_PRACTICE_NAME },
    })
    console.log(`  Created practice: ${practice.id}`)
  } else {
    console.log(`  Using existing practice: ${practice.id}`)
  }

  console.log('\n4. Creating vantage_admin in Supabase + Prisma...')
  const { error: vaError } = await supabaseAdmin.auth.admin.createUser({
    email: VANTAGE_ADMIN_EMAIL,
    email_confirm: true,
    user_metadata: { name: VANTAGE_ADMIN_NAME, role: 'vantage_admin' },
  })
  if (vaError) {
    console.error('  Supabase create vantage_admin:', vaError.message)
    process.exit(1)
  }
  await prisma.user.create({
    data: {
      email: VANTAGE_ADMIN_EMAIL,
      name: VANTAGE_ADMIN_NAME,
      passwordHash: '',
      role: 'vantage_admin',
      practiceId: null,
    },
  })
  console.log(`  ✓ ${VANTAGE_ADMIN_EMAIL} (vantage_admin)`)

  console.log('\n5. Creating practice_admin in Supabase + Prisma...')
  const { error: paError } = await supabaseAdmin.auth.admin.createUser({
    email: PRACTICE_ADMIN_EMAIL,
    email_confirm: true,
    user_metadata: { name: PRACTICE_ADMIN_NAME, role: 'practice_admin' },
  })
  if (paError) {
    console.error('  Supabase create practice_admin:', paError.message)
    process.exit(1)
  }
  await prisma.user.create({
    data: {
      email: PRACTICE_ADMIN_EMAIL,
      name: PRACTICE_ADMIN_NAME,
      passwordHash: '',
      role: 'practice_admin',
      practiceId: practice.id,
    },
  })
  console.log(`  ✓ ${PRACTICE_ADMIN_EMAIL} (practice_admin, practiceId: ${practice.id})`)

  console.log('\n✅ Done. Sessions are invalid (all Supabase users were deleted).')
  console.log('   Login is OTP-only: users receive a magic link to their email.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
