import { S3Client, PutObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3';

const endpoint = process.env.STORAGE_ENDPOINT;
const bucket = process.env.STORAGE_BUCKET;
const accessKey = process.env.STORAGE_ACCESS_KEY;
const secretKey = process.env.STORAGE_SECRET_KEY;
const region = process.env.STORAGE_REGION ?? 'us-east-1';
const useSSL = process.env.STORAGE_USE_SSL !== 'false';

const assertStorageConfig = () => {
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error('Storage is not configured (missing endpoint, bucket, or credentials)');
  }
};

const s3Client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: accessKey ?? '',
    secretAccessKey: secretKey ?? ''
  },
  tls: useSSL
});

export const getStorageBucket = () => {
  assertStorageConfig();
  return bucket as string;
};

export const uploadObject = async (
  input: Pick<PutObjectCommandInput, 'Body' | 'ContentType' | 'Key'>
) => {
  assertStorageConfig();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Body: input.Body,
    ContentType: input.ContentType,
    Key: input.Key
  });

  await s3Client.send(command);

  return {
    bucket: bucket as string,
    key: input.Key as string
  };
};
