# UX/UI Design Curriculum Planner

A comprehensive web application for tracking progress through a 12-week UX/UI design curriculum, featuring user authentication, progress tracking, assignment submission, and AI-powered feedback.

## Features

- 📚 **12-Week Structured Curriculum** - Complete UX/UI learning path
- 🔐 **User Authentication** - Sign up/sign in with email
- 📊 **Progress Tracking** - Visual progress indicators and statistics
- 📝 **Assignment Submission** - Submit text, files, and links with drag-and-drop
- 🤖 **AI Feedback** - Automated feedback on written assignments
- 👨‍🏫 **Human Feedback** - Instructor reviews for visual work
- 🎯 **Portfolio Tracking** - 4 major portfolio milestones with submission workflow
- 📈 **Learning Analytics** - Detailed progress insights and personalized recommendations
- ☁️ **File Storage** - Secure file uploads to Supabase Storage (10MB limit)
- 🌙 **Dark/Light Theme** - Toggle between themes
- 📱 **Responsive Design** - Works on all devices

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ux-ui-curriculum-planner
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Go to the SQL Editor and run the `supabase-schema.sql` file to create all tables

### 4. Environment Variables

Create a `.env.local` file in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: AI Feedback (OpenAI)
OPENAI_API_KEY=your_openai_api_key
```

### 5. Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add the environment variables in Vercel's dashboard
4. Deploy!

## Database Schema

The application uses the following main tables:

- `profiles` - User profiles (extends auth.users)
- `user_progress` - Task completion tracking
- `assignments` - User assignment submissions
- `assignment_feedback` - AI and human feedback
- `portfolio_milestones` - Portfolio project tracking

## API Endpoints

### Authentication
- `POST /api/auth` - User authentication (signup/signin)
- `GET /api/auth` - Get current user info
- `DELETE /api/auth` - Sign out

### Progress Tracking
- `GET /api/progress` - Get user progress
- `POST /api/progress` - Update task progress

### Assignments
- `GET /api/assignments` - Get user assignments
- `POST /api/assignments` - Submit new assignment
- `PUT /api/assignments` - Update existing assignment

### Portfolio Milestones
- `GET /api/portfolio` - Get user portfolio milestones
- `POST /api/portfolio` - Submit/update portfolio milestone

### Feedback System
- `GET /api/feedback` - Get feedback for assignments
- `POST /api/feedback` - Create new feedback
- `PUT /api/feedback` - Update existing feedback

### File Upload
- `POST /api/upload` - Get signed upload URL for file uploads

## AI Feedback System

The system automatically provides AI feedback for specific written tasks:

**Eligible for AI Feedback:**
- Essay questions (e.g., "checkout process redesign")
- Research reports and user interview scripts
- Usability test plans and findings
- Content audit documentation
- Information architecture analysis

**Visual tasks** (wireframes, prototypes, designs) are reviewed by human instructors.

## Development

### Local Development

```bash
npm install
npm run dev
```

This starts a local Express server on `http://localhost:8000` with mock API endpoints for testing. The server includes:

- **Mock Authentication** - Sign up/sign in with any email/password
- **Mock Progress Tracking** - Simulated progress data
- **Mock Assignment Submission** - File upload simulation
- **Mock Portfolio Tracking** - Portfolio milestone management
- **Mock Analytics** - Sample analytics data

⚠️ **Note**: Local development uses mock data and simulated responses. For full functionality, deploy to Vercel with Supabase integration.

### Production Deployment to Vercel

#### Step 1: Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```

#### Step 2: Connect Vercel to GitHub
1. Go to [vercel.com](https://vercel.com) and sign up/sign in
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the settings from `vercel.json`

#### Step 3: Set Environment Variables in Vercel
In your Vercel project dashboard, go to Settings → Environment Variables and add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key (optional)
```

#### Step 4: Deploy
- Vercel will automatically build and deploy
- Your app will be live at `https://your-project.vercel.app`

#### Step 5: Set Up Supabase (One-time)
1. Create a [Supabase](https://supabase.com) project
2. Go to SQL Editor and run the `supabase-schema.sql` file
3. Copy the project URL and API keys to Vercel environment variables

### Alternative: Static File Server (No API)

If you want to run just the frontend without API functionality:

```bash
npm run dev:static
```

This serves static files only - API calls will fail gracefully with fallbacks.

### Testing

The application includes:
- Form validation
- Error handling
- Loading states
- Responsive design testing

### Code Structure

```
/
├── index.html          # Main HTML file
├── script.js           # Frontend JavaScript
├── styles.css          # CSS styles
├── package.json        # Dependencies
├── vercel.json         # Vercel configuration
├── supabase-schema.sql # Database schema
├── api/                # Serverless functions
│   ├── auth.js
│   ├── progress.js
│   ├── assignments.js
│   └── feedback.js
└── lib/
    └── supabase.js     # Supabase client
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or issues, please create an issue in the repository or contact the maintainers.

