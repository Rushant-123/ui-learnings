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
      return handleGetAssignments(req, res, user.id)
    case 'POST':
      return handleSubmitAssignment(req, res, user.id)
    case 'PUT':
      return handleUpdateAssignment(req, res, user.id)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT'])
      return res.status(405).json({ error: `Method ${method} not allowed` })
  }
}

async function handleGetAssignments(req, res, userId) {
  const { weekNumber, taskDay } = req.query

  try {
    let query = supabase
      .from('assignments')
      .select(`
        *,
        assignment_feedback (*)
      `)
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })

    if (weekNumber) {
      query = query.eq('week_number', parseInt(weekNumber))
    }

    if (taskDay) {
      query = query.eq('task_day', taskDay)
    }

    const { data: assignments, error } = await query

    if (error) {
      console.error('Get assignments error:', error)
      return res.status(500).json({ error: 'Failed to fetch assignments' })
    }

    return res.status(200).json({ assignments: assignments || [] })
  } catch (error) {
    console.error('Get assignments error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleSubmitAssignment(req, res, userId) {
  const {
    weekNumber,
    taskDay,
    title,
    description,
    submissionType,
    content,
    fileUrls = [],
    externalLinks = []
  } = req.body

  if (!weekNumber || !taskDay || !title || !submissionType) {
    return res.status(400).json({
      error: 'Missing required fields: weekNumber, taskDay, title, submissionType'
    })
  }

  if (!['text', 'file', 'link', 'image'].includes(submissionType)) {
    return res.status(400).json({
      error: 'Invalid submission type. Must be: text, file, link, or image'
    })
  }

  try {
    const assignmentData = {
      user_id: userId,
      week_number: weekNumber,
      task_day: taskDay,
      title,
      description,
      submission_type: submissionType,
      content: submissionType === 'text' ? content : null,
      file_urls: fileUrls.length > 0 ? fileUrls : null,
      external_links: externalLinks.length > 0 ? externalLinks : null,
      submitted_at: new Date().toISOString(),
      status: 'submitted'
    }

    const { data: assignment, error } = await supabase
      .from('assignments')
      .insert(assignmentData)
      .select()
      .single()

    if (error) {
      console.error('Submit assignment error:', error)
      return res.status(500).json({ error: 'Failed to submit assignment' })
    }

    // Generate AI feedback for eligible assignments
    const aiFeedback = await generateAIFeedback(assignment)

    return res.status(201).json({
      assignment,
      aiFeedback: aiFeedback || null
    })
  } catch (error) {
    console.error('Submit assignment error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleUpdateAssignment(req, res, userId) {
  const { id, ...updates } = req.body

  if (!id) {
    return res.status(400).json({ error: 'Assignment ID is required' })
  }

  try {
    const { data: assignment, error } = await supabase
      .from('assignments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId) // Ensure user can only update their own assignments
      .select()
      .single()

    if (error) {
      console.error('Update assignment error:', error)
      return res.status(500).json({ error: 'Failed to update assignment' })
    }

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    return res.status(200).json({ assignment })
  } catch (error) {
    console.error('Update assignment error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function generateAIFeedback(assignment) {
  // Only generate AI feedback for text-based written assignments
  if (assignment.submission_type !== 'text' || !assignment.content) {
    return null
  }

  // Define which tasks are eligible for AI feedback based on our analysis
  const aiEligibleTasks = [
    // Week 1 - Written analysis tasks
    { week: 1, day: 'Friday', task: 'checkout process redesign' },

    // Week 3 - Written analysis tasks
    { week: 3, day: 'Friday', task: 'redesign wireframe improvements' },

    // Week 5 - User research tasks
    { week: 5, day: 'Tuesday', task: 'user interview script' },
    { week: 5, day: 'Wednesday', task: 'detailed personas' },
    { week: 5, day: 'Thursday', task: 'user journey mapping' },
    { week: 5, day: 'Friday', task: 'user research report' },

    // Week 6 - Content strategy tasks
    { week: 6, day: 'Friday', task: 'information architecture redesign' },

    // Week 7 - Testing tasks
    { week: 7, day: 'Monday', task: 'usability test plan' },
    { week: 7, day: 'Tuesday', task: 'moderator script' },
    { week: 7, day: 'Wednesday', task: 'findings report' },
    { week: 7, day: 'Thursday', task: 'A/B test design' }
  ]

  const isEligible = aiEligibleTasks.some(task =>
    task.week === assignment.week_number &&
    task.day === assignment.task_day
  )

  if (!isEligible) {
    return null
  }

  try {
    // For now, return mock AI feedback
    // In production, integrate with OpenAI API
    const mockFeedback = {
      feedback_type: 'ai_generated',
      content: `Thank you for submitting your ${assignment.title}. Your submission demonstrates a solid understanding of the key concepts. Here's my analysis:

**Strengths:**
• Clear structure and organization
• Good attention to detail
• Practical approach to the problem

**Areas for Improvement:**
• Consider adding more specific examples
• Could benefit from additional research
• Try to quantify your recommendations

**Overall Score: 7/10**
Keep up the great work! Consider revising based on the suggestions above.`,
      score: 7,
      strengths: [
        'Clear structure and organization',
        'Good attention to detail',
        'Practical approach to the problem'
      ],
      improvements: [
        'Add more specific examples',
        'Include additional research',
        'Quantify recommendations'
      ],
      ai_metadata: {
        model: 'gpt-4',
        confidence: 0.85,
        processing_time: '2.3s'
      }
    }

    // Save AI feedback to database
    const { data: feedback, error } = await supabase
      .from('assignment_feedback')
      .insert({
        assignment_id: assignment.id,
        ...mockFeedback
      })
      .select()
      .single()

    if (error) {
      console.error('Save AI feedback error:', error)
      return null
    }

    return feedback
  } catch (error) {
    console.error('AI feedback generation error:', error)
    return null
  }
}
