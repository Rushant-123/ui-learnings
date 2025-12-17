# 🚀 Deployment Checklist

## Pre-Deployment Setup

### ✅ GitHub Repository
- [ ] Create new repository on GitHub
- [ ] Push all project files to main branch
- [ ] Verify all files are committed (HTML, CSS, JS, API routes, package.json, vercel.json)

### ✅ Vercel Account
- [ ] Sign up at [vercel.com](https://vercel.com)
- [ ] Connect GitHub account
- [ ] Verify email

### ✅ Supabase Database (Required for Production)
- [ ] Create account at [supabase.com](https://supabase.com)
- [ ] Create new project
- [ ] Go to SQL Editor → Run `supabase-schema.sql`
- [ ] Copy Project URL and API keys

## Vercel Deployment Steps

### 1. Import Project
```
Vercel Dashboard → New Project → Import Git Repository
```

### 2. Configure Environment Variables
```
Project Settings → Environment Variables

Add these variables:
- NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
- SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
- OPENAI_API_KEY=your-openai-key (optional for AI feedback)
```

### 3. Deploy
- Click "Deploy"
- Wait for build completion (~2-3 minutes)
- Get your live URL: `https://your-project.vercel.app`

## Post-Deployment Testing

### ✅ Basic Functionality
- [ ] Homepage loads
- [ ] Navigation tabs work
- [ ] Sign up/sign in works (real Supabase auth)
- [ ] Progress tracking saves to database

### ✅ Data Persistence
- [ ] Assignments save and persist
- [ ] Reflections save and persist
- [ ] Portfolio milestones save
- [ ] Progress data survives browser refresh

### ✅ File Uploads (Optional)
- [ ] File upload to Supabase Storage works
- [ ] Files are accessible via public URLs

## Troubleshooting

### If API Routes Fail:
1. Check Vercel function logs
2. Verify environment variables are set correctly
3. Ensure Supabase project is active

### If Database Issues:
1. Verify `supabase-schema.sql` was run successfully
2. Check Row Level Security policies
3. Confirm API keys have correct permissions

### If Authentication Fails:
1. Check Supabase auth settings
2. Verify JWT secret is set
3. Test with Supabase dashboard

## Live URL Structure
```
https://your-project.vercel.app/
├── /                    # Homepage (curriculum)
├── /api/auth           # Authentication
├── /api/progress       # Progress tracking
├── /api/assignments    # Assignment management
├── /api/portfolio      # Portfolio milestones
├── /api/feedback       # Feedback system
└── /api/upload         # File uploads
```

## Cost Considerations
- **Vercel**: Free tier (100GB bandwidth/month, 100GB hours/month)
- **Supabase**: Free tier (500MB database, 50MB file storage, 2GB bandwidth)
- **OpenAI**: Pay-per-use (optional for AI feedback)

## Next Steps After Deployment
1. Test user registration flow
2. Complete a full week of curriculum
3. Submit assignments and reflections
4. Verify data persistence across sessions
5. Test on mobile devices

---
**🎉 Your UX/UI Curriculum app is ready for production!**
