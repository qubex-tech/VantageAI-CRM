import { prisma } from './db'
import { User as SupabaseUser } from '@supabase/supabase-js'

/**
 * Sync a Supabase user to Prisma User table
 * Creates a user record if it doesn't exist
 * Returns the Prisma user
 */
export async function syncSupabaseUserToPrisma(
  supabaseUser: SupabaseUser
) {
  const userEmail = supabaseUser.email
  
  if (!userEmail) {
    throw new Error('Supabase user email is required')
  }

  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email: userEmail },
  })

  if (user) {
    console.log(`User ${userEmail} already exists in Prisma`)
    return user
  }

  console.log(`Creating new user in Prisma for ${userEmail}`)

  // Get user's name from metadata
  const name = (supabaseUser.user_metadata?.name as string) || 
               supabaseUser.user_metadata?.full_name as string || 
               null

  // For new users, create a new practice for them
  // Each user gets their own practice (multi-tenant architecture)
  const practice = await prisma.practice.create({
    data: {
      name: name ? `${name}'s Practice` : 'My Practice',
    },
  })

  console.log(`Created practice ${practice.id} for user ${userEmail}`)

  // Create the user
  try {
    user = await prisma.user.create({
      data: {
        email: userEmail,
        name: name || 'User', // Default name if not provided
        passwordHash: '', // Supabase handles password, we don't store it
        practiceId: practice.id,
        role: 'admin', // First user is admin
      },
    })

    console.log(`Successfully created user ${user.id} in Prisma`)
    return user
  } catch (error) {
    console.error(`Failed to create user ${userEmail} in Prisma:`, error)
    throw error
  }
}
