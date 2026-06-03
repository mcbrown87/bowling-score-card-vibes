import { prisma } from '@/server/db/client';
import { copyStoredImagesToAccount } from '@/server/services/copyStoredImages';

type CliArgs = {
  fromEmail?: string;
  toEmail?: string;
  imageIds: string[];
  execute: boolean;
};

const usage = [
  'Usage:',
  '  npm run admin:copy-images -- --from <source-email> --to <destination-email> --image <stored-image-id> [--image <stored-image-id>] [--execute]',
  '',
  'Defaults to dry-run. Pass --execute to copy storage objects and create destination records.'
].join('\n');

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {
    imageIds: [],
    execute: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--from') {
      args.fromEmail = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--to') {
      args.toEmail = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--image') {
      const imageId = argv[index + 1];
      if (imageId) {
        args.imageIds.push(imageId);
      }
      index += 1;
      continue;
    }

    if (arg === '--execute') {
      args.execute = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      console.log(usage);
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.fromEmail || !args.toEmail || args.imageIds.length === 0) {
    throw new Error(usage);
  }

  return args;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await copyStoredImagesToAccount({
    fromEmail: args.fromEmail as string,
    toEmail: args.toEmail as string,
    imageIds: args.imageIds,
    execute: args.execute
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.results.some((copyResult) => copyResult.status === 'failed')) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
