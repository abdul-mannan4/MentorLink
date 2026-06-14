import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://isxxzkcanajavlrietue.supabase.co';
const supabaseKey = 'sb_publishable_QifhcxwPmmPSdxR66Qz_Ag_Cwgcvfpb';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing exact reply count query for a123Hannan...");
  const id = '3bfb548b-b1a3-4463-87f3-de0ce66b35fa';
  const result = await supabase
    .from("reply")
    .select("reply_id", { count: "exact", head: true })
    .eq("mentor_id", id);
  console.log("Result:", result);
}

test();
