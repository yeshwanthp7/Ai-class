const apiKey = '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';

async function testREST() {
  const cases = [
    {
      name: 'Magpie with string enum',
      functionId: '877104f7-e885-42b9-8de8-f6e4c6303969',
      body: {
        text: "Hello, this is a test of the NVIDIA text to speech system.",
        language_code: "en-US",
        encoding: "LINEAR_PCM",
        sample_rate_hz: 16000,
        voice_name: "Magpie-Multilingual.en-US.Aria"
      }
    },
    {
      name: 'Magpie with int enum',
      functionId: '877104f7-e885-42b9-8de8-f6e4c6303969',
      body: {
        text: "Hello, this is a test of the NVIDIA text to speech system.",
        language_code: "en-US",
        encoding: 1,
        sample_rate_hz: 16000,
        voice_name: "Magpie-Multilingual.en-US.Aria"
      }
    },
    {
      name: 'Chatterbox with string enum',
      functionId: 'ddacc747-1269-4fab-bfd9-8f593dead106',
      body: {
        text: "Hello, this is a test of the NVIDIA text to speech system.",
        language_code: "en-US",
        encoding: "LINEAR_PCM",
        sample_rate_hz: 16000,
        voice_name: "Chatterbox-Multilingual.en-US.Male"
      }
    }
  ];

  for (const c of cases) {
    try {
      console.log(`\nTesting case: ${c.name}`);
      const url = `https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/${c.functionId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(c.body)
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
