import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jblooqpgetighjenbvaf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpibG9vcXBnZXRpZ2hqZW5idmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5ODg0NzgsImV4cCI6MjA4NzU2NDQ3OH0.5fM6ykpO_c57--9aedcD7U1LQIPPEAFMYo0sRr4Z2Nw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
