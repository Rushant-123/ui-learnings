import { supabase } from '../lib/supabase.js'

export default async function handler(req, res) {
  const { method } = req

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${method} not allowed` })
  }

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

  try {
    const { fileName, fileType, fileSize } = req.body

    if (!fileName || !fileType || !fileSize) {
      return res.status(400).json({
        error: 'Missing required fields: fileName, fileType, fileSize'
      })
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (fileSize > maxSize) {
      return res.status(400).json({
        error: 'File size exceeds 10MB limit'
      })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/markdown',
      'application/zip', 'application/x-zip-compressed'
    ]

    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({
        error: 'File type not allowed. Allowed types: images, PDF, text files, ZIP archives'
      })
    }

    // Generate unique file path
    const fileExt = fileName.split('.').pop()
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const filePath = `uploads/${user.id}/${timestamp}_${randomId}.${fileExt}`

    // Create signed upload URL
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .createSignedUploadUrl(filePath)

    if (uploadError) {
      console.error('Create upload URL error:', uploadError)
      return res.status(500).json({ error: 'Failed to create upload URL' })
    }

    return res.status(200).json({
      uploadUrl: uploadData.signedUrl,
      filePath,
      publicUrl: `${supabase.supabaseUrl}/storage/v1/object/public/user-uploads/${filePath}`
    })

  } catch (error) {
    console.error('File upload setup error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// Handle actual file upload to Supabase Storage
export const config = {
  api: {
    bodyParser: false, // Disable body parser for file uploads
  },
}
