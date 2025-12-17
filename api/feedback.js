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
      return handleGetFeedback(req, res, user.id)
    case 'POST':
      return handleCreateFeedback(req, res, user.id)
    case 'PUT':
      return handleUpdateFeedback(req, res, user.id)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT'])
      return res.status(405).json({ error: `Method ${method} not allowed` })
  }
}

async function handleGetFeedback(req, res, userId) {
  const { assignmentId } = req.query

  try {
    let query = supabase
      .from('assignment_feedback')
      .select(`
        *,
        reviewer:reviewer_id (
          id,
          email,
          profiles (
            full_name,
            avatar_url
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (assignmentId) {
      query = query.eq('assignment_id', assignmentId)
    } else {
      // If no specific assignment, get feedback for user's assignments
      query = query.in('assignment_id',
        supabase.from('assignments').select('id').eq('user_id', userId)
      )
    }

    const { data: feedback, error } = await query

    if (error) {
      console.error('Get feedback error:', error)
      return res.status(500).json({ error: 'Failed to fetch feedback' })
    }

    return res.status(200).json({ feedback: feedback || [] })
  } catch (error) {
    console.error('Get feedback error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleCreateFeedback(req, res, userId) {
  const {
    assignmentId,
    feedbackType,
    content,
    score,
    strengths = [],
    improvements = []
  } = req.body

  if (!assignmentId || !feedbackType || !content) {
    return res.status(400).json({
      error: 'Missing required fields: assignmentId, feedbackType, content'
    })
  }

  if (!['ai_generated', 'instructor_review', 'peer_review'].includes(feedbackType)) {
    return res.status(400).json({
      error: 'Invalid feedback type. Must be: ai_generated, instructor_review, or peer_review'
    })
  }

  // Verify that the user can provide feedback on this assignment
  // Users can provide feedback on their own assignments (for self-review) or if they're an instructor
  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .select('user_id')
    .eq('id', assignmentId)
    .single()

  if (assignmentError || !assignment) {
    return res.status(404).json({ error: 'Assignment not found' })
  }

  // For now, allow users to review their own assignments (self-review) or instructors can review any
  // In a production app, you'd have role-based permissions
  const canReview = assignment.user_id === userId || feedbackType === 'instructor_review'

  if (!canReview) {
    return res.status(403).json({ error: 'You do not have permission to review this assignment' })
  }

  try {
    const feedbackData = {
      assignment_id: assignmentId,
      feedback_type: feedbackType,
      reviewer_id: feedbackType !== 'ai_generated' ? userId : null,
      content,
      score: score ? parseInt(score) : null,
      strengths: strengths.length > 0 ? strengths : null,
      improvements: improvements.length > 0 ? improvements : null,
      ai_metadata: feedbackType === 'ai_generated' ? {
        model: 'gpt-4',
        confidence: 0.85,
        processing_time: '2.3s'
      } : null
    }

    const { data: feedback, error } = await supabase
      .from('assignment_feedback')
      .insert(feedbackData)
      .select(`
        *,
        reviewer:reviewer_id (
          id,
          email,
          profiles (
            full_name,
            avatar_url
          )
        )
      `)
      .single()

    if (error) {
      console.error('Create feedback error:', error)
      return res.status(500).json({ error: 'Failed to create feedback' })
    }

    // Update assignment status if it's instructor feedback
    if (feedbackType === 'instructor_review') {
      await supabase
        .from('assignments')
        .update({
          status: score >= 8 ? 'approved' : 'needs_revision',
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
    }

    return res.status(201).json({ feedback })
  } catch (error) {
    console.error('Create feedback error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleUpdateFeedback(req, res, userId) {
  const { id, ...updates } = req.body

  if (!id) {
    return res.status(400).json({ error: 'Feedback ID is required' })
  }

  try {
    // Verify the user owns this feedback (can only update their own reviews)
    const { data: existingFeedback, error: fetchError } = await supabase
      .from('assignment_feedback')
      .select('reviewer_id, feedback_type')
      .eq('id', id)
      .single()

    if (fetchError || !existingFeedback) {
      return res.status(404).json({ error: 'Feedback not found' })
    }

    // Only allow updates to human-generated feedback by the reviewer
    if (existingFeedback.feedback_type === 'ai_generated' ||
        (existingFeedback.reviewer_id && existingFeedback.reviewer_id !== userId)) {
      return res.status(403).json({ error: 'You do not have permission to update this feedback' })
    }

    const { data: feedback, error } = await supabase
      .from('assignment_feedback')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        reviewer:reviewer_id (
          id,
          email,
          profiles (
            full_name,
            avatar_url
          )
        )
      `)
      .single()

    if (error) {
      console.error('Update feedback error:', error)
      return res.status(500).json({ error: 'Failed to update feedback' })
    }

    return res.status(200).json({ feedback })
  } catch (error) {
    console.error('Update feedback error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
