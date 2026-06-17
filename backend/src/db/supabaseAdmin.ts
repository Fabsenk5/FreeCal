import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://eokjccuvhxmguozbffgr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva2pjY3V2aHhtZ3VvemJmZmdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTkyNjIsImV4cCI6MjA5MDM5NTI2Mn0.XaFyb11h2jojtRQaFkcklyE9GU0ngS1-qu5zSnlNtQg';

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
