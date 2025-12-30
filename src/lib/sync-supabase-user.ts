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

  try {
    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        practice: true,
      },
    })

    if (user) {
      // Verify practice still exists (in case it was deleted)
      if (!user.practice) {
        console.error(`User ${userEmail} exists but practice ${user.practiceId} is missing`)
        // Try to find or create a practice for this user
        let practice = await prisma.practice.findUnique({
          where: { id: user.practiceId },
        })
        
        if (!practice) {
          // Practice was deleted, create a new one
          const name = (supabaseUser.user_metadata?.name as string) || 
                       supabaseUser.user_metadata?.full_name as string || 
                       user.name || 'User'
          practice = await prisma.practice.create({
            data: {
              id: user.practiceId, // Try to use the same ID
              name: `${name}'s Practice`,
            },
          })
          console.log(`Recreated practice ${practice.id} for user ${userEmail}`)
        }
      }
      
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
    let practice
    try {
      practice = await prisma.practice.create({
        data: {
          name: name ? `${name}'s Practice` : 'My Practice',
        },
      })
      console.log(`Created practice ${practice.id} for user ${userEmail}`)
    } catch (practiceError) {
      console.error(`Failed to create practice for ${userEmail}:`, practiceError)
      throw new Error(`Failed to create practice: ${practiceError instanceof Error ? practiceError.message : 'Unknown error'}`)
    }

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
        include: {
          practice: true,
        },
      })

      console.log(`Successfully created user ${user.id} in Prisma`)
      return user
    } catch (userError: any) {
      console.error(`Failed to create user ${userEmail} in Prisma:`, userError)
      
      // If user creation fails, try to clean up the practice we created
      try {
        await prisma.practice.delete({ where: { id: practice.id } })
      } catch (cleanupError) {
        console.error(`Failed to cleanup practice ${practice.id}:`, cleanupError)
      }
      
      // Provide more specific error message
      if (userError?.code === 'P2002') {
        // Unique constraint violation - user might have been created by another request
        const existingUser = await prisma.user.findUnique({
          where: { email: userEmail },
        })
        if (existingUser) {
          console.log(`User ${userEmail} was created by another request, returning existing user`)
          return existingUser
        }
        throw new Error('User with this email already exists')
      }
      
      throw new Error(`Failed to create user: ${userError?.message || 'Unknown error'}`)
    }
  } catch (error) {
    console.error(`Error in syncSupabaseUserToPrisma for ${userEmail}:`, error)
    // Re-throw with more context
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to sync user: ${String(error)}`)
  }
}
