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
      return handleGetProgress(req, res, user.id)
    case 'POST':
      return handleUpdateProgress(req, res, user.id)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${method} not allowed` })
  }
}

async function handleGetProgress(req, res, userId) {
  try {
    const { data: progress, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: true })
      .order('task_day', { ascending: false })

    if (error) {
      console.error('Get progress error:', error)
      return res.status(500).json({ error: 'Failed to fetch progress' })
    }

    // Calculate statistics
    const stats = calculateProgressStats(progress)

    return res.status(200).json({
      progress,
      stats
    })
  } catch (error) {
    console.error('Get progress error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleUpdateProgress(req, res, userId) {
  const { weekNumber, taskDay, completed } = req.body

  if (!weekNumber || !taskDay) {
    return res.status(400).json({ error: 'Missing required fields: weekNumber, taskDay' })
  }

  try {
    const progressData = {
      user_id: userId,
      week_number: weekNumber,
      task_day: taskDay,
      completed: completed || false,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('user_progress')
      .upsert(progressData, {
        onConflict: 'user_id,week_number,task_day'
      })
      .select()
      .single()

    if (error) {
      console.error('Update progress error:', error)
      return res.status(500).json({ error: 'Failed to update progress' })
    }

    // Recalculate stats after update
    const { data: allProgress } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)

    const stats = calculateProgressStats(allProgress || [])

    return res.status(200).json({
      progress: data,
      stats
    })
  } catch (error) {
    console.error('Update progress error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

function calculateProgressStats(progress) {
  const totalTasks = 60 // Based on curriculum analysis
  const completedTasks = progress.filter(p => p.completed).length
  const completedWeeks = [...new Set(
    progress
      .filter(p => p.completed)
      .map(p => p.week_number)
  )].length

  // Calculate weekly progress
  const weeklyProgress = {}
  progress.forEach(p => {
    if (!weeklyProgress[p.week_number]) {
      weeklyProgress[p.week_number] = {
        total: 5, // Assuming 5 tasks per week
        completed: 0
      }
    }
    if (p.completed) {
      weeklyProgress[p.week_number].completed++
    }
  })

  return {
    totalTasks,
    completedTasks,
    completedWeeks,
    overallProgress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    weeklyProgress
  }
}
