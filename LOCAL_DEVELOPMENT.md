# Local Development Migration Guide

This guide will help you migrate the FreeCal project from Altan platform to your local development environment.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **npm, pnpm, or yarn** package manager
- **VS Code** (recommended) or your preferred IDE
- **Git** (optional, for version control)

## Step 1: Download Project Files

### From Altan Platform

1. Log into your Altan dashboard
2. Navigate to your FreeCal project
3. Click "Download Project" or export all files
4. Extract the ZIP file to your preferred location

```bash
# Example:
cd ~/Projects
unzip freecal-project.zip
cd freecal
```

## Step 2: Install Dependencies

```bash
# Using npm
npm install

# Using pnpm (faster, recommended)
pnpm install

# Using yarn
yarn install
```

This will install all required dependencies including:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui components
- Supabase client
- date-fns
- And many more...

## Step 3: Environment Setup

The project is already configured to use the Altan Cloud backend. No environment variables need to be changed!

**Important:** The credentials are already in `src/lib/supabase.ts`. You don't need a `.env.local` file unless you want to override these values.

**Optional:** Create `.env.local` if you want to use different credentials:

```env
VITE_SUPABASE_URL=https://eeaf921a-3e9.db-pool-europe-west1.altan.ai
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwNzkxMDgzMzUsImlhdCI6MTc2Mzc0ODMzNSwiaXNzIjoic3VwYWJhc2UiLCJyb2xlIjoiYW5vbiJ9.RA7N8UZVIpBwamYWQxcBkLMVMov0TNy8_cSfnBOBpXM
```

If you create `.env.local`, update `src/lib/supabase.ts` to use environment variables:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

## Step 4: Run Development Server

```bash
npm run dev
```

The app will start at `http://localhost:5173`

Open your browser and you should see the FreeCal login page!

## Step 5: Set Up VS Code (Recommended)

### Install VS Code Extensions

```bash
# Install recommended extensions
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension saoudrizwan.claude-dev  # Cline for AI assistance
```

### Configure VS Code Settings

Create `.vscode/settings.json` in your project:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

## Step 6: Set Up Cline (AI Assistant)

Cline is an AI coding assistant that works within VS Code.

1. **Install Cline extension** (already done if you ran the command above)
2. **Open Cline panel** (click Cline icon in sidebar)
3. **Add API key:**
   - Get an Anthropic API key from https://console.anthropic.com/
   - Enter it in Cline settings
   - Choose "Claude 3.5 Sonnet" model

4. **Give Cline context:**
   - Tell Cline to read `ARCHITECTURE.md`
   - Tell Cline to read `DEVELOPMENT.md`
   - Cline can now understand your codebase!

**Example Cline commands:**
- "Add a location field to the events page"
- "Fix the TypeScript error in CalendarView"
- "Create a new component for event templates"

## Step 7: Verify Everything Works

### Test Authentication

1. Go to `http://localhost:5173/signup`
2. Create a test account
3. Check the database to see if the profile was created

### Test Database Connection

```bash
# Open browser console on the app
# Paste this:
await supabase.from('profiles').select('*').limit(1)

# Should return data without errors
```

### Run Type Check

```bash
npm run type-check
```

Should complete without errors.

### Run Linter

```bash
npm run lint
```

Fix any warnings/errors that appear.

## Step 8: Build for Production

```bash
npm run build
```

This creates a `dist/` folder with optimized production files.

Preview the production build:

```bash
npm run preview
```

## Common Issues & Solutions

### Issue: "Cannot find module '@/...' "

**Solution:** Check your `tsconfig.json` has the correct path mapping:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Issue: "Port 5173 already in use"

**Solution:** Kill the existing process or use a different port:

```bash
npm run dev -- --port 3000
```

### Issue: "Database connection failed"

**Solution:** 
1. Check your internet connection
2. Verify the Altan Cloud URL is correct in `src/lib/supabase.ts`
3. Check if the Altan Cloud instance is running

### Issue: Type errors in database queries

**Solution:** 
1. Ensure types in `src/lib/supabase.ts` match your database schema
2. Run `npm run type-check` to see all type errors
3. Update the `Database` interface if schema changed

## Git Setup (Optional)

Initialize git for version control:

```bash
git init
git add .
git commit -m "Initial commit - FreeCal local setup"
```

Create `.gitignore` if it doesn't exist:

```
node_modules/
dist/
.vite/
.env.local
.DS_Store
*.log
```

## Next Steps

Now that your local environment is set up:

1. **Read the docs:**
   - `ARCHITECTURE.md` - Understand the system
   - `DEVELOPMENT.md` - Learn coding patterns
   - `NEXT_STEPS.md` - See planned features

2. **Start developing:**
   - Use Cline to help implement features
   - Follow the coding standards in `DEVELOPMENT.md`
   - Test thoroughly before committing

3. **Deploy:**
   - Push to GitHub
   - Deploy to Vercel/Netlify
   - Keep using the same Altan Cloud backend

## Need Help?

- Check `ARCHITECTURE.md` for system design questions
- Check `DEVELOPMENT.md` for coding questions
- Check `NEXT_STEPS.md` for feature ideas
- Ask Cline for help with specific tasks!

## Success! 🎉

You now have FreeCal running locally and can develop with AI assistance. Happy coding!
