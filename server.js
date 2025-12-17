const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Mock Supabase client for local development
const mockSupabase = {
  auth: {
    signUp: async () => ({ data: { user: { id: 'mock-user-id', email: 'test@example.com' } }, error: null }),
    signInWithPassword: async () => ({ data: { user: { id: 'mock-user-id', email: 'test@example.com' }, session: { access_token: 'mock-token' } }, error: null }),
    getUser: async () => ({ data: { user: { id: 'mock-user-id', email: 'test@example.com' } }, error: null }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null })
  },
  from: (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: null }),
        order: () => ({
          then: (cb) => cb([])
        })
      }),
      then: (cb) => cb([])
    }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: { id: 'mock-id', ...arguments[0] }, error: null })
      })
    }),
    update: () => ({
      eq: () => ({
        select: () => ({
          single: async () => ({ data: { id: 'mock-id', ...arguments[0] }, error: null })
        })
      })
    })
  }),
  storage: {
    from: () => ({
      createSignedUploadUrl: async () => ({
        data: { signedUrl: 'https://mock-upload-url.com', filePath: 'mock-path' },
        error: null
      })
    })
  }
};

// API Routes
app.post('/api/auth', async (req, res) => {
  const { action, email, password, fullName } = req.body;

  try {
    if (action === 'signup') {
      // Simplified signup - no email verification needed for progress tracking
      const user = {
        id: 'user_' + Date.now(),
        email: email,
        created_at: new Date().toISOString(),
        profile: { full_name: fullName || email.split('@')[0] }
      };

      // Store user in memory (in production this would be in database)
      if (!global.mockUsers) global.mockUsers = {};
      global.mockUsers[email] = { ...user, password };

      return res.status(200).json({
        message: 'Account created successfully!',
        user: user
      });
    } else if (action === 'signin') {
      // Check if user exists in our mock storage
      if (!global.mockUsers || !global.mockUsers[email]) {
        return res.status(400).json({ error: 'User not found' });
      }

      const user = global.mockUsers[email];
      // In production, you'd verify password hash
      if (password !== user.password) {
        return res.status(400).json({ error: 'Invalid password' });
      }

      return res.status(200).json({
        message: 'Signin successful',
        user: user,
        session: { access_token: 'mock_token_' + user.id }
      });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth', async (req, res) => {
  try {
    const result = await mockSupabase.auth.getUser('mock-token');
    if (result.error) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.status(200).json({
      user: {
        ...result.data.user,
        profile: { full_name: 'Test User' }
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/auth', async (req, res) => {
  try {
    await mockSupabase.auth.signOut();
    return res.status(200).json({ message: 'Signed out successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/progress', async (req, res) => {
  // Mock progress data
  const progress = [
    { user_id: 'mock-user-id', week_number: 1, task_day: 'Monday', completed: true },
    { user_id: 'mock-user-id', week_number: 1, task_day: 'Tuesday', completed: true },
    { user_id: 'mock-user-id', week_number: 1, task_day: 'Wednesday', completed: false },
  ];

  const stats = {
    totalTasks: 60,
    completedTasks: progress.filter(p => p.completed).length,
    completedWeeks: 1,
    overallProgress: Math.round((progress.filter(p => p.completed).length / 60) * 100)
  };

  return res.status(200).json({ progress, stats });
});

app.post('/api/progress', async (req, res) => {
  const { weekNumber, taskDay, completed } = req.body;

  const progressData = {
    user_id: 'mock-user-id',
    week_number: weekNumber,
    task_day: taskDay,
    completed,
    completed_at: completed ? new Date().toISOString() : null
  };

  return res.status(200).json({ progress: progressData });
});

app.get('/api/assignments', async (req, res) => {
  // Return stored assignments
  const assignments = global.mockAssignments || [];
  return res.status(200).json({ assignments });
});

app.post('/api/assignments', async (req, res) => {
  const assignmentData = {
    id: 'mock-assignment-id-' + Date.now(),
    ...req.body,
    submitted_at: new Date().toISOString(),
    status: req.body.submissionType === 'reflection' ? 'approved' : 'submitted'
  };

  // Store in memory (in production this would be in database)
  if (!global.mockAssignments) global.mockAssignments = [];
  global.mockAssignments.push(assignmentData);

  return res.status(201).json({ assignment: assignmentData });
});

app.put('/api/assignments', async (req, res) => {
  const { id, ...updates } = req.body;

  if (!global.mockAssignments) global.mockAssignments = [];
  const assignmentIndex = global.mockAssignments.findIndex(a => a.id === id);

  if (assignmentIndex === -1) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  global.mockAssignments[assignmentIndex] = {
    ...global.mockAssignments[assignmentIndex],
    ...updates,
    updated_at: new Date().toISOString()
  };

  return res.status(200).json({ assignment: global.mockAssignments[assignmentIndex] });
});

app.get('/api/portfolio', async (req, res) => {
  // Mock portfolio data
  const portfolio = [];
  return res.status(200).json({ portfolio });
});

app.post('/api/portfolio', async (req, res) => {
  const milestoneData = {
    id: 'mock-milestone-id-' + Date.now(),
    ...req.body,
    submitted_at: new Date().toISOString()
  };

  return res.status(200).json({ milestone: milestoneData });
});

app.post('/api/upload', async (req, res) => {
  const { fileName } = req.body;

  return res.status(200).json({
    uploadUrl: 'https://mock-upload-url.com',
    filePath: `uploads/mock-user/${Date.now()}_${fileName}`,
    publicUrl: `https://mock-storage.com/uploads/mock-user/${Date.now()}_${fileName}`
  });
});

// Serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Local development server running at http://localhost:${PORT}`);
  console.log(`📝 Mock API endpoints available for testing`);
  console.log(`⚠️  Using mock data - connect to Supabase for production`);
});
