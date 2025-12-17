import { supabase } from '../lib/supabase.js'

export default async function handler(req, res) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handleAuth(req, res)
    case 'GET':
      return handleGetUser(req, res)
    case 'DELETE':
      return handleSignOut(req, res)
    default:
      res.setHeader('Allow', ['POST', 'GET', 'DELETE'])
      return res.status(405).json({ error: `Method ${method} not allowed` })
  }
}

async function handleAuth(req, res) {
  const { action, email, password, fullName } = req.body

  try {
    switch (action) {
      case 'signup':
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName
            }
          }
        })

        if (signupError) {
          return res.status(400).json({ error: signupError.message })
        }

        return res.status(200).json({
          message: 'Signup successful. Please check your email for confirmation.',
          user: signupData.user
        })

      case 'signin':
        const { data: signinData, error: signinError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (signinError) {
          return res.status(400).json({ error: signinError.message })
        }

        return res.status(200).json({
          message: 'Signin successful',
          user: signinData.user,
          session: signinData.session
        })

      case 'reset-password':
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`
        })

        if (resetError) {
          return res.status(400).json({ error: resetError.message })
        }

        return res.status(200).json({
          message: 'Password reset email sent'
        })

      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('Auth error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleGetUser(req, res) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!user) {
      return res.status(401).json({ error: 'No user found' })
    }

    // Get additional profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError)
    }

    return res.status(200).json({
      user: {
        ...user,
        profile: profile || null
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleSignOut(req, res) {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ message: 'Signed out successfully' })
  } catch (error) {
    console.error('Sign out error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
