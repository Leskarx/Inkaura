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
  console.log("Checking production_orders...");
  const { data, error } = await supabase.from('production_orders').select('*').limit(1);
  if (error) {
    console.error("production_orders Error:", error.message);
  } else {
    console.log("production_orders exists! Data:", data);
  }
}
test();
