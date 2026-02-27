# RecoFilms

A simple movie recommendation page.

## Deployment

This project is compatible with [Vercel](https://vercel.com). The server proxy has been moved to `api/proxy.js` and exports an Express app, which is automatically treated as a serverless function. Static assets are built into `dist` and served by Vercel's static hosting.

1. Push the repo to a Git provider (GitHub, GitLab, etc.).
2. Create a new project on Vercel and import the repository.
3. Ensure `npm run build` is the build command and `dist` is the output directory.
4. Add any required environment variables (e.g. `TMDB_API_KEY`) in the Vercel dashboard.
