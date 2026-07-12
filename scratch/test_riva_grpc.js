const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const dns = require('dns');

const packageDefinition = protoLoader.loadSync('scratch/riva_tts.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const ttsProto = grpc.loadPackageDefinition(packageDefinition).nvidia.riva.tts;

const keys = {
  'New Key': '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',
};

const functionId = '877104f7-e885-42b9-8de8-f6e4c6303969';

async function resolveIPv4(host) {
  return new Promise((resolve, reject) => {
    dns.lookup(host, { family: 4 }, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });
}

async function run() {
  try {
    const host = 'grpc.nvcf.nvidia.com';
    const ipv4Address = await resolveIPv4(host);
    console.log(`Resolved ${host} to IPv4: ${ipv4Address}`);

    for (const [name, apiKey] of Object.entries(keys)) {
      console.log(`\nTesting key: ${name} (${apiKey.substring(0, 15)}...)`);
      
      const client = new ttsProto.RivaSpeechSynthesis(
        `ipv4:${ipv4Address}:443`,
        grpc.credentials.createSsl(),
        {
          'grpc.ssl_target_name_override': host,
          'grpc.default_authority': host
        }
      );

      const metadata = new grpc.Metadata();
      metadata.add('function-id', functionId);
      metadata.add('authorization', `Bearer ${apiKey}`);

      const request = {
        text: "this audio is generated from nvidia's text to speech model",
        language_code: "en-US",
        encoding: "LINEAR_PCM",
        sample_rate_hz: 16000,
        voice_name: "Chatterbox-Multilingual.en-US.Male"
      };

      await new Promise((resolve) => {
        client.Synthesize(request, metadata, (err, response) => {
          if (err) {
            console.error(`gRPC Error for ${name}:`, err.message || err);
          } else {
            console.log(`Success for ${name}! Audio size:`, response.audio.length, 'bytes');
          }
          resolve();
        });
      });
    }
  } catch (error) {
    console.error('Resolution / Run failed:', error);
  }
}

run();
