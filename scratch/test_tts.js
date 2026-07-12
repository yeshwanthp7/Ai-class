const apiKey = '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';

async function run() {
  const urls = [
    'https://ai.api.nvidia.com/v1/audio/speech',
    'https://ai.api.nvidia.com/v1/audio/synthesize',
    'https://ai.api.nvidia.com/v1/audio/nvidia/magpie-tts-multilingual',
    'https://ai.api.nvidia.com/v1/audio/resemble-ai/chatterbox-tts-multilingual'
  ];

  for (const url of urls) {
    try {
      console.log('Testing URL:', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'nvidia/magpie-tts-multilingual',
          input: 'Hello world',
          voice: 'aria'
        })
      });
      console.log('Status:', res.status);
      console.log('Headers:', Object.fromEntries(res.headers.entries()));
      const body = await res.text();
      console.log('Body snippet:', body.substring(0, 500));
    } catch (err) {
      console.error(err);
    }
  }
}

run();
