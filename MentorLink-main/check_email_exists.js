import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://isxxzkcanajavlrietue.supabase.co';
const supabaseKey = 'sb_publishable_QifhcxwPmmPSdxR66Qz_Ag_Cwgcvfpb';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = '23ntucsfl1002@student.ntu.edu.pk';
  console.log("Checking profiles for university_email:", email);
  
  const { data, error } = await supabase
    .from("profile")
    .select("id, name, user_name, university_email")
    .eq("university_email", email);

  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log("Found profile records:", data);
}

run();
