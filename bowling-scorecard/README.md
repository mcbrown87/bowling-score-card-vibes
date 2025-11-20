# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Database & Prisma

The app now persists users in Postgres via Prisma. To work locally:

1. Copy `.env.example` to `.env` (or `.env.local`) and set `DATABASE_URL` if you are not using Docker.
2. Start the database with `docker compose up db` from the repo root (or `docker compose up` to run the full stack).
3. Apply migrations with `npx prisma migrate dev` inside `bowling-scorecard/`. Use `npx prisma migrate deploy` in CI/prod. When running `docker compose up` the `app-migrate` helper service automatically runs `prisma migrate deploy` before the Next.js dev server starts; re-run it manually with `docker compose run app-migrate` after schema changes.
4. Generate the Prisma client after schema changes via `npx prisma generate`.

Migrations live in `prisma/migrations/` and the primary schema is `prisma/schema.prisma`.

## Object Storage (MinIO)

Uploaded scorecard photos now persist to an S3-compatible bucket and are linked to the user in the new `StoredImage` table (run `npx prisma migrate dev` after pulling these changes).

- `docker compose up minio minio-setup` starts a local MinIO server (9000) and seeds the default bucket; `docker compose up` also brings it online automatically.
- Configure credentials and endpoints in `.env` (`MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION`, `STORAGE_USE_SSL`).
- The admin console is available at http://localhost:9001 when running locally.

## Authentication

We use NextAuth with the Prisma adapter to support credential-based signup and login.

- Set `NEXTAUTH_SECRET` (e.g., `openssl rand -base64 32`), `NEXTAUTH_URL`, and `AUTH_TRUST_HOST=true` in `.env`.
- Visit `/signup` to create an account; the form calls `POST /api/auth/signup` which hashes the password with bcrypt and stores it in Postgres.
- Use `/login` to sign in. Credentials are verified through NextAuth’s Credentials provider, and sessions are stored in the `sessions` table.
- Protected routes call `auth()` on the server; the homepage redirects anonymous visitors to the auth screens.
- Google sign-in is available; set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`. If you already have a credentials-based account with the same email, Google will now link to it automatically.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
