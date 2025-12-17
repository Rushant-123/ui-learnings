import { supabase } from '../lib/supabase.js'

export default async function handler(req, res) {
  const { method } = req

  // Verify authentication
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.substring(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  switch (method) {
    case 'GET':
      return handleGetPortfolio(req, res, user.id)
    case 'POST':
      return handleSubmitPortfolio(req, res, user.id)
    case 'PUT':
      return handleUpdatePortfolio(req, res, user.id)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT'])
      return res.status(405).json({ error: `Method ${method} not allowed` })
  }
}

async function handleGetPortfolio(req, res, userId) {
  try {
    const { data: portfolio, error } = await supabase
      .from('portfolio_milestones')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: true })

    if (error) {
      console.error('Get portfolio error:', error)
      return res.status(500).json({ error: 'Failed to fetch portfolio milestones' })
    }

    return res.status(200).json({ portfolio: portfolio || [] })
  } catch (error) {
    console.error('Get portfolio error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleSubmitPortfolio(req, res, userId) {
  const {
    weekNumber,
    milestoneTitle,
    description,
    deliverables = [],
    projectLinks = []
  } = req.body

  if (!weekNumber || !milestoneTitle) {
    return res.status(400).json({
      error: 'Missing required fields: weekNumber, milestoneTitle'
    })
  }

  try {
    // Check if milestone already exists
    const { data: existingMilestone, error: checkError } = await supabase
      .from('portfolio_milestones')
      .select('id')
      .eq('user_id', userId)
      .eq('week_number', weekNumber)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Check milestone error:', checkError)
      return res.status(500).json({ error: 'Failed to check existing milestone' })
    }

    const milestoneData = {
      user_id: userId,
      week_number: weekNumber,
      milestone_title: milestoneTitle,
      description,
      deliverables: deliverables.length > 0 ? deliverables : null,
      status: 'submitted',
      submitted_at: new Date().toISOString()
    }

    let result
    if (existingMilestone) {
      // Update existing milestone
      const { data, error } = await supabase
        .from('portfolio_milestones')
        .update(milestoneData)
        .eq('id', existingMilestone.id)
        .select()
        .single()

      if (error) {
        console.error('Update portfolio error:', error)
        return res.status(500).json({ error: 'Failed to update portfolio milestone' })
      }
      result = data
    } else {
      // Create new milestone
      const { data, error } = await supabase
        .from('portfolio_milestones')
        .insert(milestoneData)
        .select()
        .single()

      if (error) {
        console.error('Submit portfolio error:', error)
        return res.status(500).json({ error: 'Failed to submit portfolio milestone' })
      }
      result = data
    }

    return res.status(200).json({ milestone: result })
  } catch (error) {
    console.error('Submit portfolio error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleUpdatePortfolio(req, res, userId) {
  const { id, ...updates } = req.body

  if (!id) {
    return res.status(400).json({ error: 'Portfolio milestone ID is required' })
  }

  try {
    const { data: milestone, error } = await supabase
      .from('portfolio_milestones')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId) // Ensure user can only update their own milestones
      .select()
      .single()

    if (error) {
      console.error('Update portfolio error:', error)
      return res.status(500).json({ error: 'Failed to update portfolio milestone' })
    }

    if (!milestone) {
      return res.status(404).json({ error: 'Portfolio milestone not found' })
    }

    return res.status(200).json({ milestone })
  } catch (error) {
    console.error('Update portfolio error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
