/**
 * Script to create or update a Vantage Admin user
 * Usage: tsx scripts/create-vantage-admin.ts
 */

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

const VANTAGE_ADMIN_EMAIL = 'developer@qubewallet.io'
const VANTAGE_ADMIN_NAME = 'Saqib Nasir'

async function main() {
  console.log('Creating/updating Vantage Admin user...')
  console.log(`Email: ${VANTAGE_ADMIN_EMAIL}`)
  console.log(`Name: ${VANTAGE_ADMIN_NAME}`)

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️  Supabase not configured - creating user in Prisma only')
    console.warn('   User will need to be created in Supabase Auth manually or use password reset')
  }

  // Create Supabase admin client if configured
  const supabaseAdmin = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null

  try {
    // Check if user exists in Prisma
    let user = await prisma.user.findUnique({
      where: { email: VANTAGE_ADMIN_EMAIL },
    })

    if (user) {
      console.log('✓ User already exists in Prisma')
      
      // Update user to be Vantage Admin if not already
      if (user.role !== 'vantage_admin' || user.practiceId !== null) {
        console.log('  Updating user to Vantage Admin role...')
        user = await prisma.user.update({
          where: { email: VANTAGE_ADMIN_EMAIL },
          data: {
            role: 'vantage_admin',
            practiceId: null, // Vantage Admins don't belong to a practice
            name: VANTAGE_ADMIN_NAME,
          },
        })
        console.log('✓ User updated to Vantage Admin')
      } else {
        console.log('✓ User is already a Vantage Admin')
      }

      // Update name if different
      if (user.name !== VANTAGE_ADMIN_NAME) {
        user = await prisma.user.update({
          where: { email: VANTAGE_ADMIN_EMAIL },
          data: { name: VANTAGE_ADMIN_NAME },
        })
        console.log('✓ User name updated')
      }
    } else {
      console.log('Creating new user in Prisma...')
      
      // Create user in Supabase Auth first if configured
      if (supabaseAdmin) {
        try {
          // Check if user exists in Supabase
          const { data: existingSupabaseUser } = await supabaseAdmin.auth.admin.listUsers()
          const supabaseUser = existingSupabaseUser.users.find(u => u.email === VANTAGE_ADMIN_EMAIL)

          if (!supabaseUser) {
            console.log('  Creating user in Supabase Auth (without password - use password reset)...')
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              email: VANTAGE_ADMIN_EMAIL,
              email_confirm: true,
              user_metadata: {
                name: VANTAGE_ADMIN_NAME,
                role: 'vantage_admin',
              },
            })

            if (createError) {
              if (createError.message?.includes('already registered') || 
                  createError.message?.includes('already exists')) {
                console.log('  User already exists in Supabase Auth')
              } else {
                console.error('  Error creating user in Supabase Auth:', createError.message)
                console.warn('  Continuing with Prisma user creation...')
              }
            } else if (newUser?.user) {
              console.log('✓ User created in Supabase Auth')
            }
          } else {
            console.log('✓ User already exists in Supabase Auth')
          }
        } catch (supabaseErr) {
          console.error('  Error with Supabase Auth:', supabaseErr)
          console.warn('  Continuing with Prisma user creation...')
        }
      }

      // Create user in Prisma
      user = await prisma.user.create({
        data: {
          email: VANTAGE_ADMIN_EMAIL,
          name: VANTAGE_ADMIN_NAME,
          passwordHash: '', // Supabase manages passwords, or empty if Supabase not configured
          role: 'vantage_admin',
          practiceId: null, // Vantage Admins don't belong to a practice
        },
      })
      console.log('✓ User created in Prisma')
    }

    console.log('\n✅ Vantage Admin user configured successfully!')
    console.log(`\nUser Details:`)
    console.log(`  ID: ${user.id}`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Name: ${user.name}`)
    console.log(`  Role: ${user.role}`)
    console.log(`  Practice ID: ${user.practiceId || 'null (Vantage Admin)'}`)
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log(`\n⚠️  Note: Supabase is not configured.`)
      console.log(`   If using Supabase Auth, create the user manually or use password reset.`)
      console.log(`   If using NextAuth, the user can set their password on first login.`)
    } else {
      console.log(`\n📧 User can now log in at: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login`)
      console.log(`   If password not set, use "Forgot Password" to set it.`)
    }
  } catch (error) {
    console.error('❌ Error creating/updating Vantage Admin user:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

