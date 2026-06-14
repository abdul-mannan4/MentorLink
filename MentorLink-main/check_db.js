import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://isxxzkcanajavlrietue.supabase.co';
const supabaseKey = 'sb_publishable_QifhcxwPmmPSdxR66Qz_Ag_Cwgcvfpb';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('notification').insert({
    recipient_id: '3bfb548b-b1a3-4463-87f3-de0ce66b35fa',
    sender_id: '3bfb548b-b1a3-4463-87f3-de0ce66b35fa',
    question_id: 21,
    reply_id: 1,
    type: 'new_reply'
  });
  console.log('Error:', error);
}

check();
