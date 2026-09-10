import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const { error } = await client.rpc('run_workspace_automation');
if (error) { console.error('Workspace automation failed:', error.message); process.exitCode=1; }
else console.log('Recurring tasks and deadline reminders processed.');
