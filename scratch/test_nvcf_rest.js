const apiKey = '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';
const functionId = '877104f7-e885-42b9-8de8-f6e4c6303969';

async function testREST() {
  const url = `https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/${functionId}`;
  
  const payloads = [
    {
      name: 'Riva Proto structure (voice_name)',
      body: {
        text: "Hello, this is a test of the NVIDIA text to speech system.",
        language_code: "en-US",
        voice_name: "Chatterbox-Multilingual.en-US.Male"
      }
    },
    {
      name: 'Riva Proto structure (Magpie voice)',
      body: {
        text: "Hello, this is a test of the NVIDIA text to speech system.",
        language_code: "en-US",
        voice_name: "Magpie-Multilingual.en-US.Aria"
      }
    }
  ];

  for (const p of payloads) {
    try {
      console.log('Testing payload:', p.name);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(p.body)
      });
      console.log('Status:', res.status);
      console.log('Headers:', Object.fromEntries(res.headers.entries()));
      const text = await res.text();
      console.log('Response snippet:', text.substring(0, 1000));
    } catch (err) {
      console.error(err);
    }
  }
}

testREST();
