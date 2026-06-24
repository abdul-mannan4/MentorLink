import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://isxxzkcanajavlrietue.supabase.co';
const supabaseKey = 'sb_publishable_QifhcxwPmmPSdxR66Qz_Ag_Cwgcvfpb';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function run() {
  const email = "23ntucsfl1003@student.ntu.edu.pk";
  const password = "23ntucsfl1003@student.ntu.edu.pk";

  console.log("Signing in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Sign-in failed:", authError.message);
    return;
  }

  const userId = authData.user.id;
  console.log(`Successfully signed in. User ID: ${userId}`);

  console.log("Fetching profile via direct Supabase client...");
  const { data: profileDirect, error: profileDirectError } = await supabase
    .from("profile")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileDirectError) {
    console.error("Direct profile fetch error:", profileDirectError.message);
  } else {
    console.log("Direct profile data:", JSON.stringify(profileDirect, null, 2));
  }

  console.log("Fetching profile via local Express Server (if running)...");
  try {
    const res = await fetch("http://localhost:5000/api/db/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authData.session.access_token}`
      },
      body: JSON.stringify({
        table: "profile",
        method: "select",
        columns: "*",
        filters: [{ type: "eq", column: "id", value: userId }],
        maybeSingle: true
      })
    });
    const json = await res.json();
    console.log("Express Server profile response:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("Could not reach Express server (it might not be running yet):", err.message);
  }
}

run();
