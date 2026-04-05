require('dotenv/config');

const fs = require('node:fs/promises');
const path = require('node:path');
const process = require('node:process');
const { execFileSync } = require('node:child_process');

const { chromium } = require('playwright');
const { hash } = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const repoRoot = path.resolve(__dirname, '../..');
const packageRoot = path.resolve(__dirname, '..');
const fixtureImagePath = path.resolve(packageRoot, 'TestImages/blah.jpg');
const browserProfileDir = path.resolve(packageRoot, 'output/playwright/bootstrap-profile');

const databaseUrl = normalizeServiceUrl(process.env.DATABASE_URL, {
  db: 'localhost'
});
const storageEndpoint = normalizeServiceUrl(process.env.STORAGE_ENDPOINT, {
  minio: 'localhost'
});
const storageBucket = process.env.STORAGE_BUCKET;
const storageAccessKey = process.env.STORAGE_ACCESS_KEY;
const storageSecretKey = process.env.STORAGE_SECRET_KEY;
const storageRegion = process.env.STORAGE_REGION || 'us-east-1';
const storageUseSsl = process.env.STORAGE_USE_SSL !== 'false';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

const bootstrapUser = {
  email: process.env.BOOTSTRAP_USER_EMAIL || 'dev+bootstrap@example.com',
  password: process.env.BOOTSTRAP_USER_PASSWORD || 'devpassword123',
  name: process.env.BOOTSTRAP_USER_NAME || 'Bootstrap User'
};

const sampleGames = [
  {
    gameIndex: 0,
    playerName: 'Player One',
    totalScore: 20,
    frames: Array.from({ length: 9 }, () => ({
      rolls: [{ pins: 1 }, { pins: 1 }],
      isStrike: false,
      isSpare: false,
      score: 2
    })),
    tenthFrame: {
      rolls: [{ pins: 1 }, { pins: 1 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 20
    }
  },
  {
    gameIndex: 1,
    playerName: 'Player Two',
    totalScore: 30,
    frames: Array.from({ length: 9 }, () => ({
      rolls: [{ pins: 2 }, { pins: 1 }],
      isStrike: false,
      isSpare: false,
      score: 3
    })),
    tenthFrame: {
      rolls: [{ pins: 2 }, { pins: 1 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 30
    }
  }
];

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getFlagValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }
  return value;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

const bootstrapImageCount = parsePositiveInteger(
  getFlagValue('--image-count') ?? process.env.BOOTSTRAP_IMAGE_COUNT ?? '1',
  1
);

function normalizeServiceUrl(rawUrl, hostMap) {
  if (!rawUrl) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    const replacementHost = hostMap[parsed.hostname];

    if (!replacementHost) {
      return rawUrl;
    }

    parsed.hostname = replacementHost;
    return parsed.toString();
  } catch (_error) {
    return rawUrl;
  }
}

function getStorageClient() {
  if (!storageEndpoint || !storageBucket || !storageAccessKey || !storageSecretKey) {
    throw new Error('Storage is not configured. Check STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY, and STORAGE_SECRET_KEY in bowling-scorecard/.env.');
  }

  return new S3Client({
    region: storageRegion,
    endpoint: storageEndpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: storageAccessKey,
      secretAccessKey: storageSecretKey
    },
    tls: storageUseSsl
  });
}

async function waitForApp(timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${appUrl}/api/health`, {
        headers: { Accept: 'application/json' }
      });

      if (response.ok) {
        return;
      }
    } catch (_error) {
      // The app is still starting up.
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Timed out waiting for ${appUrl}/api/health`);
}

async function ensureAppIsRunning() {
  try {
    await waitForApp(3000);
    console.log(`App is already responding at ${appUrl}.`);
    return;
  } catch (_error) {
    console.log('Local app is not responding. Starting Docker services...');
  }

  execFileSync(
    'docker',
    [
      'compose',
      'up',
      '-d',
      '--build',
      'db',
      'redis',
      'minio',
      'minio-setup',
      'app-migrate',
      'app',
      'queue-worker'
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit'
    }
  );

  console.log('Waiting for the local app to become healthy...');
  await waitForApp();
}

async function seedBootstrapData() {
  const passwordHash = await hash(bootstrapUser.password, 12);

  const user = await prisma.user.upsert({
    where: { email: bootstrapUser.email },
    update: {
      name: bootstrapUser.name,
      passwordHash
    },
    create: {
      email: bootstrapUser.email,
      name: bootstrapUser.name,
      passwordHash
    }
  });

  const fixtureBuffer = await fs.readFile(fixtureImagePath);
  const storageClient = getStorageClient();
  const bootstrapPrefix = 'fixtures/bootstrap/';
  const fixtureBaseName = path.basename(fixtureImagePath);

  await prisma.storedImage.deleteMany({
    where: {
      userId: user.id,
      objectKey: {
        startsWith: bootstrapPrefix
      }
    }
  });

  for (let index = 0; index < bootstrapImageCount; index += 1) {
    const sequence = String(index + 1).padStart(3, '0');
    const objectKey = `${bootstrapPrefix}${sequence}-${fixtureBaseName}`;
    const originalFileName =
      bootstrapImageCount === 1 ? fixtureBaseName : `bootstrap-${sequence}-${fixtureBaseName}`;

    await storageClient.send(
      new PutObjectCommand({
        Bucket: storageBucket,
        Key: objectKey,
        Body: fixtureBuffer,
        ContentType: 'image/jpeg'
      })
    );

    const storedImage = await prisma.storedImage.create({
      data: {
        userId: user.id,
        bucket: storageBucket,
        objectKey,
        originalFileName,
        contentType: 'image/jpeg',
        sizeBytes: fixtureBuffer.byteLength,
        createdAt: new Date(Date.now() - (bootstrapImageCount - index - 1) * 60_000)
      }
    });

    await prisma.bowlingScore.createMany({
      data: sampleGames.map((game) => ({
        storedImageId: storedImage.id,
        gameIndex: game.gameIndex,
        playerName: game.playerName,
        totalScore: game.totalScore,
        frames: game.frames,
        tenthFrame: game.tenthFrame,
        isEstimate: false,
        provider: 'bootstrap-script'
      }))
    });
  }

  console.log(`Seeded ${bootstrapImageCount} bootstrap image${bootstrapImageCount === 1 ? '' : 's'} for ${bootstrapUser.email}.`);
}

async function openLoggedInBrowser() {
  await fs.mkdir(browserProfileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(browserProfileDir, {
    headless: hasFlag('--headless') || hasFlag('--ci'),
    viewport: { width: 1440, height: 960 }
  });

  await context.clearCookies();

  const page = context.pages()[0] || (await context.newPage());

  await page.goto(`${appUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  if (new URL(page.url()).pathname === '/login') {
    await page.getByLabel('Email').fill(bootstrapUser.email);
    await page.getByLabel('Password').fill(bootstrapUser.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  }

  await page.waitForURL((url) => url.pathname === '/', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.getByText(`Signed in as ${bootstrapUser.name}`).waitFor({ timeout: 10000 });

  console.log(`Logged in as ${bootstrapUser.email}.`);
  console.log(
    `Fixture image and scores are available in the Library for user ${bootstrapUser.email} (${bootstrapImageCount} image${bootstrapImageCount === 1 ? '' : 's'}).`
  );

  if (hasFlag('--headless') || hasFlag('--ci')) {
    await context.storageState({
      path: path.resolve(packageRoot, 'output/playwright/bootstrap-storage-state.json')
    });
    await context.close();
    return;
  }

  console.log('The browser is ready for manual interaction. Close it when you are done.');

  await new Promise((resolve) => {
    const browser = context.browser();
    if (!browser) {
      resolve();
      return;
    }
    browser.once('disconnected', resolve);
  });
}

async function main() {
  try {
    await ensureAppIsRunning();
    await seedBootstrapData();
    await openLoggedInBrowser();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
