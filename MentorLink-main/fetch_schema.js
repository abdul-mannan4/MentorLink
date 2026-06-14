import fs from 'fs';

async function fetchSchema() {
  const supabaseUrl = 'https://isxxzkcanajavlrietue.supabase.co';
  const supabaseKey = 'sb_publishable_QifhcxwPmmPSdxR66Qz_Ag_Cwgcvfpb';

  const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  const data = await res.json();
  fs.writeFileSync('schema.json', JSON.stringify(data, null, 2));
  console.log('Schema fetched and saved to schema.json');
}

fetchSchema();
