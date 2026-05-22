@AGENTS.md

## Deploy Configuration (configured by /setup-deploy)
- Platform: Vercel
- Production URL: https://easyheictojpg.vercel.app
- GitHub Repository: https://github.com/alomsoltanul/easyfiles.git
- Deploy workflow: auto-deploy on push to main branch
- Deploy status command: vercel ls --prod
- Merge method: squash
- Project type: web app (Next.js)
- Post-deploy health check: https://easyheictojpg.vercel.app
- Framework: Next.js
- Node.js Version: 24.x

### Custom deploy hooks
- Pre-merge: none
- Deploy trigger: automatic on push to main
- Deploy status: poll production URL or `vercel ls --prod`
- Health check: https://easyheictojpg.vercel.app
