import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('sample_orders').select('sample_order_id, status, quantity, quotation_id').limit(1);
  console.log("Error:", error);
  const { data: data2, error: error2 } = await supabase.from('sample_orders').select('sample_order_id, status, sample_quantity, quotation_id').limit(1);
  console.log("Error2:", error2);
}
run();
