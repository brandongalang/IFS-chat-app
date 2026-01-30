import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('parts_display')
    .select('id, display_name, last_active, created_at')
    .eq('user_id', '21c525eb-5443-4445-a835-3b665d1580d1')
    .limit(3);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Raw data from Supabase:');
  console.log(JSON.stringify(data, null, 2));

  // Check the actual string format
  data?.forEach((row) => {
    console.log('\n---');
    console.log(
      'last_active type:',
      typeof row.last_active,
      'value:',
      JSON.stringify(row.last_active)
    );
    console.log(
      'created_at type:',
      typeof row.created_at,
      'value:',
      JSON.stringify(row.created_at)
    );
  });
}

main();
