# FreeCal - Calendar & Availability Manager

A modern calendar application for managing events and finding free time with partners/family.

## Features

- 📅 **Calendar Management** - Create, edit, delete events with recurring options
- 👥 **Relationship Management** - Connect with partners/family via email
- 🔍 **Free Time Finder** - Smart availability calculator across multiple users
- 🎨 **Custom Colors** - Personalized calendar colors per user
- 🔐 **Admin Approval System** - Private beta with approval workflow
- 👁️ **Event Visibility** - Share events as viewer or attendee
- 📱 **Mobile-First Design** - Optimized for all devices

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui components
- **Database:** Altan Cloud (PostgreSQL via PostgREST)
- **Authentication:** Altan Auth (GoTrue)
- **State Management:** React Context API
- **Routing:** React Router v6
- **Date Handling:** date-fns

## Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- Modern IDE (VS Code recommended)
- Cline extension (for AI-assisted development)

## Quick Start

### 1. Clone/Copy Project

```bash
# If migrating from Altan platform, download project files
# Copy all files to your local directory
cd your-project-directory
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
# or
yarn install
```

### 3. Environment Setup

Create `.env.local` file in root:

```env
VITE_SUPABASE_URL=https://eeaf921a-3e9.db-pool-europe-west1.altan.ai
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwNzkxMDgzMzUsImlhdCI6MTc2Mzc0ODMzNSwiaXNzIjoic3VwYWJhc2UiLCJyb2xlIjoiYW5vbiJ9.RA7N8UZVIpBwamYWQxcBkLMVMov0TNy8_cSfnBOBpXM
```

### 4. Run Development Server

```bash
npm run dev
# or
pnpm dev
```

App runs at: `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
npm run preview  # Preview production build
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── calendar/       # Calendar-specific components
│   ├── profile/        # Profile/relationship components
│   └── ui/             # shadcn/ui design system
├── contexts/           # React contexts (Auth)
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configurations
│   └── supabase.ts    # Altan Cloud client setup
├── pages/              # Route pages
├── routes.tsx          # Route definitions
└── App.tsx             # Root component
```

## Database Schema

See `ARCHITECTURE.md` for detailed schema documentation.

**Key tables:**
- `profiles` - User profiles
- `events` - Calendar events
- `event_attendees` - Event attendees (blocks calendar)
- `event_viewers` - Event viewers (visibility only)
- `relationships` - User connections

## Admin Access

Admin user: `fabiank5@hotmail.com`

Admin features:
- User approval management
- Access to all system features

## Development Workflow

See `DEVELOPMENT.md` for:
- Coding standards
- Component patterns
- Database operations
- Testing guidelines

## Troubleshooting

**Build errors:**
```bash
# Clear cache and reinstall
rm -rf node_modules dist .vite
npm install
```

**Type errors:**
- Check `src/lib/supabase.ts` for database types
- Ensure TypeScript version is 5.x+

**Auth issues:**
- Verify `.env.local` credentials
- Check Altan Cloud connection

## Contributing

See `DEVELOPMENT.md` for contribution guidelines.

## Next Steps

See `NEXT_STEPS.md` for planned features and improvements.

## License

Private project - All rights reserved
