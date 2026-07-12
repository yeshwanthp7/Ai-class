const apiKey = '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';
const url = 'https://integrate.api.nvidia.com/v1/models';
const fs = require('fs');

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const data = await res.json();
    const ids = data.data.map(m => m.id);
    fs.writeFileSync('scratch/model_ids.txt', JSON.stringify(ids, null, 2), 'utf-8');
    console.log('Saved', ids.length, 'model IDs to scratch/model_ids.txt');
  } catch (err) {
    console.error(err);
  }
}
run();
