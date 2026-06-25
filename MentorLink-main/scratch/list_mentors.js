import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://isxxzkcanajavlrietue.supabase.co';
const supabaseKey = 'sb_publishable_QifhcxwPmmPSdxR66Qz_Ag_Cwgcvfpb';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: mentors, error } = await supabase.from("mentor").select("*");
  if (error) {
    console.error("Error fetching mentors:", error);
  } else {
    console.log(`Found ${mentors.length} mentors:`, mentors);
  }
}

run();
