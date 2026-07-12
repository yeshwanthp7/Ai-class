const apiKey = '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';
const url = 'https://integrate.api.nvidia.com/v1/audio/speech';

const models = [
  'nvidia/magpie-tts-multilingual',
  'resemble-ai/chatterbox-multilingual-tts',
  'resemble-ai/chatterbox-tts-multilingual',
  'nvidia/chatterbox-multilingual-tts',
  'nvidia/chatterbox-tts-multilingual'
];

async function run() {
  for (const model of models) {
    try {
      console.log('Testing model:', model);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          input: 'Hello world, this is a test of the text to speech model.',
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
