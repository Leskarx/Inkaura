import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('./.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching customers...");
  const { data, error } = await supabase.from('customers').select('*').limit(1);
  if (error) {
    console.error("Select Error:", error);
  } else {
    console.log("Customer data format:", data);
  }
  
  console.log("Attempting to insert...");
  const { error: insertError } = await supabase.from('customers').insert({
    first_name: 'test',
    email: 'test@example.com'
  });
  if (insertError) {
    console.error("Insert Error:", insertError);
  }
}
test();
