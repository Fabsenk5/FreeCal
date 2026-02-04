# FreeCal - Calendar & Availability Manager

A modern, open-source calendar application for managing events and finding free time with partners/family.

## Features

- 📅 **Calendar Management** - Create, edit, delete events with recurring options
- 👥 **Relationship Management** - Connect with partners/family via email
- 🔍 **Free Time Finder** - Smart availability calculator across multiple users
- 🎨 **Custom Colors** - Personalized calendar colors per user
- 🔐 **Secure Authentication** - JWT-based authentication with secure session management
- 👁️ **Event Visibility** - Share events as viewer or attendee
- 📱 **Mobile-First Design** - Optimized for all devices

## Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui components
- **State Management:** React Context API + TanStack Query
- **Routing:** React Router v6
- **Maps:** Leaflet + React Leaflet
- **Date Handling:** date-fns

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** Custom JWT + bcrypt
- **Validation:** Zod

## Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- PostgreSQL Database

## Quick Start

### 1. Clone Project

```bash
git clone https://github.com/yourusername/freecal.git
cd freecal
```

### 2. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd backend
npm install
# Return to root
cd ..
```

### 3. Environment Setup

Create `.env.local` file in the root directory:

```env
VITE_API_URL=http://localhost:3000
```

Create `.env` file in the `backend` directory:

```env
DATABASE_URL=postgres://user:password@host:port/dbname
PORT=3000
JWT_SECRET=your_jwt_secret
```

### 4. Database Setup

Initialize the database schema:

```bash
cd backend
npm run db:push
cd ..
```

### 5. Run Development Servers

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
# In a new terminal
npm run dev
```

App runs at: `http://localhost:5173`

## Project Structure

```
├── src/                # Frontend Source
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React Contexts
│   ├── hooks/          # Custom Hooks
│   ├── lib/            # Utilities (API, etc.)
│   └── pages/          # Route Pages
├── backend/            # Backend Source
│   ├── src/
│   │   ├── db/         # Drizzle ORM Schema & Config
│   │   ├── routes/     # API Routes
│   │   └── index.ts    # Server Entry Point
└── public/             # Static Assets
```

## Contributing

Contributions are welcome! Please read `DEVELOPMENT.md` for details on our code of conduct, and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Open Source Acknowledgments

This project is built on the shoulders of giants. We gratefully acknowledge the following open source projects:

- **React** (MIT) - Facebook
- **Vite** (MIT) - Yuxi (Evan) You
- **Tailwind CSS** (MIT) - Tailwind Labs
- **Express** (MIT) - OpenJS Foundation
- **Drizzle ORM** (Apache-2.0) - Drizzle Team
- **Radix UI** (MIT) - WorkOS
- **Lucide** (ISC) - Lucide Contributors
- **Leaflet** (BSD-2-Clause) - Vladimir Agafonkin
- **Date-fns** (MIT) - Sasha Koss
- **Zod** (MIT) - Colin McDonnell
- **TanStack Query** (MIT) - Tanner Linsley

And many others listed in `package.json`.
