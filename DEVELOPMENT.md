# Development Guide

## Setup for AI-Assisted Development (Cline)

### 1. IDE Setup (VS Code Recommended)

**Install VS Code:**
- Download from https://code.visualstudio.com/

**Required Extensions:**
```bash
code --install-extension saoudrizwan.claude-dev  # Cline extension
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
```

**Open Project:**
```bash
cd your-project-directory
code .
```

### 2. Cline Configuration

**Access Cline:**
- Click Cline icon in VS Code sidebar
- Or use Command Palette: `Cmd/Ctrl + Shift + P` → "Cline: Open"

**First Time Setup:**
1. Enter your Anthropic API key (for Claude)
2. Choose model (Claude 3.5 Sonnet recommended)
3. Grant file system permissions

**Using Cline:**
- Natural language commands
- Cline can read/write files, run commands
- Always review code before accepting

**Example commands:**
- "Add a new field to the events table for location"
- "Create a component to display recurring events"
- "Fix the TypeScript error in CalendarView.tsx"

### 3. Project-Specific Cline Context

**Key files to reference:**
- `ARCHITECTURE.md` - System design
- `src/lib/supabase.ts` - Database types
- `src/contexts/AuthContext.tsx` - Auth patterns
- `src/hooks/useEvents.ts` - Data fetching patterns

**When asking Cline to make changes:**
- Reference architecture docs
- Follow existing patterns
- Maintain type safety
- Update tests if applicable

## Coding Standards

### TypeScript

**Always use explicit types:**
```typescript
// ✅ Good
const handleSubmit = async (e: React.FormEvent) => { ... }
const events: Event[] = await fetchEvents()

// ❌ Bad
const handleSubmit = async (e) => { ... }
const events = await fetchEvents()
```

**Use interface for objects, type for unions:**
```typescript
interface Event {
  id: string
  title: string
}

type Status = 'pending' | 'approved' | 'rejected'
```

### React Patterns

**Custom Hooks for Data:**
```typescript
// src/hooks/useMyData.ts
export const useMyData = () => {
  const [data, setData] = useState<MyType[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchData()
  }, [])
  
  const fetchData = async () => { ... }
  
  return { data, loading, refetch: fetchData }
}
```

**Component Structure:**
```typescript
// 1. Imports
import { useState } from 'react'
import { Button } from '@/components/ui/button'

// 2. Types/Interfaces
interface MyComponentProps {
  title: string
}

// 3. Component
export const MyComponent = ({ title }: MyComponentProps) => {
  // 4. Hooks
  const [state, setState] = useState()
  
  // 5. Handlers
  const handleClick = () => { ... }
  
  // 6. Render
  return <div>...</div>
}
```

### Database Operations

**Always use typed queries:**
```typescript
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Event = Database['public']['Tables']['events']['Row']
type EventInsert = Database['public']['Tables']['events']['Insert']

// Insert
const { data, error } = await supabase
  .from('events')
  .insert<EventInsert>({
    title: 'Meeting',
    start_time: new Date().toISOString(),
    // ...
  })

// Select with joins
const { data } = await supabase
  .from('events')
  .select(`
    *,
    event_attendees(user_id, profiles(display_name, calendar_color))
  `)
```

**Error Handling:**
```typescript
try {
  const { data, error } = await supabase
    .from('events')
    .insert({ ... })
    
  if (error) throw error
  toast.success('Event created!')
} catch (error: any) {
  console.error('Error:', error)
  toast.error(error.message || 'Something went wrong')
}
```

### Styling

**Use Tailwind utility classes:**
```tsx
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <span className="text-lg font-semibold">Title</span>
</div>
```

**Use design system components:**
```tsx
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

<Button variant="default" size="lg">Click me</Button>
```

**CSS variables for theme colors:**
```css
/* Use these in Tailwind */
bg-primary
text-primary-foreground
border-border
```

## Common Tasks

### Adding a New Page

1. Create page component: `src/pages/MyPage.tsx`
2. Add route in `src/routes.tsx`:
```typescript
{
  path: '/my-page',
  element: (
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  )
}
```
3. Add navigation if needed

### Adding a Database Table

1. Write SQL migration using Altan's `execute_sql` tool
2. Update types in `src/lib/supabase.ts`:
```typescript
export interface Database {
  public: {
    Tables: {
      my_new_table: {
        Row: { ... }
        Insert: { ... }
        Update: { ... }
      }
    }
  }
}
```
3. Create custom hook in `src/hooks/useMyNewTable.ts`
4. Add RLS policies

### Adding a New Feature

1. Plan the feature (database schema, UI, logic)
2. Create database tables/columns if needed
3. Create/update hooks for data fetching
4. Create/update components
5. Add to relevant pages
6. Test thoroughly

## Testing

**Manual Testing Checklist:**
- [ ] Sign up new user
- [ ] Login existing user
- [ ] Create event
- [ ] Edit own event
- [ ] Cannot edit others' events
- [ ] Add relationship
- [ ] Accept relationship request
- [ ] Free time finder shows correct availability
- [ ] Event viewers vs attendees work correctly

**Browser Testing:**
- Chrome/Edge (primary)
- Safari (macOS/iOS)
- Firefox

**Responsive Testing:**
- Mobile (375px)
- Tablet (768px)
- Desktop (1280px+)

## Debugging

**React DevTools:**
- Install React DevTools extension
- Inspect component tree and props

**Database Queries:**
```typescript
// Add .explain() to see query plan
const { data, error } = await supabase
  .from('events')
  .select('*')
  .explain({ analyze: true, verbose: true })
```

**Console Logging:**
```typescript
console.log('Events:', events)
console.error('Error:', error)
console.table(events)  // Nice table view
```

## Git Workflow (When Ready)

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit often
git add .
git commit -m "Add feature X"

# Push to remote
git push origin feature/my-feature

# Create pull request
```

## Resources

- **React Docs:** https://react.dev/
- **TypeScript Docs:** https://www.typescriptlang.org/docs/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com/
- **Altan Documentation:** https://docs.altan.ai/
- **date-fns:** https://date-fns.org/
