const {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client
} = require('@aws-sdk/client-s3');

const endpoint = process.env.STORAGE_ENDPOINT;
const bucket = process.env.STORAGE_BUCKET;
const accessKey = process.env.STORAGE_ACCESS_KEY;
const secretKey = process.env.STORAGE_SECRET_KEY;
const region = process.env.STORAGE_REGION || 'us-east-1';

if (!endpoint || !bucket || !accessKey || !secretKey) {
  throw new Error('Storage setup is missing its endpoint, bucket, or credentials');
}

const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey
  },
  tls: process.env.STORAGE_USE_SSL !== 'false'
});

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function ensureBucket() {
  let lastError;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`Storage bucket ${bucket} already exists.`);
      return;
    } catch (headError) {
      const statusCode = headError.$metadata?.httpStatusCode;

      if (statusCode === 404) {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`Created storage bucket ${bucket}.`);
        return;
      }

      lastError = headError;
      console.log(`Waiting for storage at ${endpoint} (attempt ${attempt}/30)...`);
      await delay(2000);
    }
  }

  throw lastError;
}

ensureBucket().catch((error) => {
  console.error('Unable to initialize object storage:', error);
  process.exitCode = 1;
});
