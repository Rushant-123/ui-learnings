// Minimal entrypoint for Vercel static deployment
export default function handler(req, res) {
  // This file exists just to give Vercel an entrypoint
  // Static files and API routes are handled by vercel.json configuration
  res.status(200).send('Static site entrypoint');
}
