/**
 * Migration script to help existing users who were created in Prisma
 * but don't have Supabase Auth accounts.
 * 
 * This script can be run manually to help users migrate.
 * 
 * Usage:
 * 1. User requests password reset via the UI
 * 2. They receive email from Supabase
 * 3. They set a new password in Supabase
 * 4. The user is then synced to Prisma automatically
 */

import { prisma } from '../src/lib/db'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * Check if a user exists in Supabase Auth
 */
async function userExistsInSupabase(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.admin.getUserByEmail(email)
    return !error && data.user !== null
  } catch (error) {
    return false
  }
}

/**
 * Create a Supabase Auth user for an existing Prisma user
 * This requires the user to set their password via password reset
 */
async function createSupabaseUserForPrismaUser(email: string) {
  try {
    // Check if user already exists in Supabase
    const exists = await userExistsInSupabase(email)
    if (exists) {
      console.log(`User ${email} already exists in Supabase Auth`)
      return { success: true, message: 'User already exists in Supabase' }
    }

    // Create user in Supabase (requires password reset to set password)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email
    })

    if (error) {
      console.error(`Error creating Supabase user for ${email}:`, error)
      return { success: false, error: error.message }
    }

    console.log(`Created Supabase user for ${email}. User should reset password.`)
    return { success: true, userId: data.user.id }
  } catch (error) {
    console.error(`Exception creating Supabase user for ${email}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Main function - check a user and help them migrate
 */
async function main() {
  const email = process.argv[2]
  
  if (!email) {
    console.log('Usage: tsx scripts/migrate-user-to-supabase.ts <email>')
    console.log('This script creates a Supabase Auth account for an existing Prisma user.')
    console.log('The user will need to use "Forgot Password" to set their password.')
    process.exit(1)
  }

  // Check if user exists in Prisma
  const prismaUser = await prisma.user.findUnique({
    where: { email },
  })

  if (!prismaUser) {
    console.error(`User ${email} not found in Prisma database`)
    process.exit(1)
  }

  console.log(`Found user ${email} in Prisma database`)
  
  // Check if user exists in Supabase
  const existsInSupabase = await userExistsInSupabase(email)
  
  if (existsInSupabase) {
    console.log(`User ${email} already exists in Supabase Auth`)
    console.log('They should be able to log in. If not, they may need to reset their password.')
  } else {
    console.log(`User ${email} does NOT exist in Supabase Auth`)
    console.log('Creating Supabase Auth account...')
    
    const result = await createSupabaseUserForPrismaUser(email)
    
    if (result.success) {
      console.log(`\n✅ Success! User ${email} now has a Supabase Auth account.`)
      console.log(`\nNext steps:`)
      console.log(`1. User should go to the login page`)
      console.log(`2. Click "Forgot Password"`)
      console.log(`3. Enter their email address`)
      console.log(`4. Check their email for password reset link`)
      console.log(`5. Set a new password`)
      console.log(`6. Log in with their email and new password`)
    } else {
      console.error(`\n❌ Failed to create Supabase user:`, result.error)
      process.exit(1)
    }
  }
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

