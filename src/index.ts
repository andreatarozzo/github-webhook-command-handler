import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { loggingMiddleware } from './middleware';
import { createNodeMiddleware } from '@octokit/webhooks';
import { initGitAndGithub } from './lib/github';
import { prCommandHandler } from './lib/github';
import { App } from '@octokit/app';
import { logger, spawnAsyncProcess } from './utils';

dotenv.config();

const app = express();
app.set('trust proxy', true);

// Default Middleware
app.use(helmet());
app.use(loggingMiddleware);

const GithubApp = new App({
  appId: parseInt(process.env.GH_APP_ID!),
  privateKey: process.env.GH_APP_PRIVATE_KEY!,
  oauth: {
    clientId: process.env.GH_APP_CLIENT_ID!,
    clientSecret: process.env.GH_APP_CLIENT_SECRET!,
  },
  webhooks: {
    secret: process.env.GH_APP_WEBHOOK_SECRET!,
  },
});

// Webhook event registration
GithubApp.webhooks.on('issue_comment.created', async ({ payload }) => {
  try {
    const { GithubInstance, GitInstance } = await initGitAndGithub(
      GithubApp.octokit.auth,
      process.env.GH_APP_INSTALLATION_ID!,
      spawnAsyncProcess,
      logger,
    );
    prCommandHandler(payload, GithubInstance, GitInstance);
  } catch (e: any) {
    logger.error(e);
  }
});

// Setting Github webhooks middleware
app.use(createNodeMiddleware(GithubApp.webhooks, { path: process.env.WEBHOOK_PATH! }));

// Start the server
app.listen(process.env.PORT!, () => {
  console.log(`Server is running at http://localhost:${process.env.PORT!}`);
});
