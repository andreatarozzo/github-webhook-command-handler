import { IssueCommentEvent } from '@octokit/webhooks-types';
import { prCommandHandler } from '../../../../src/lib/github/handlers/prCommandHandler';
import {
  breakingChangesInterceptor,
  interactionWithDummyJsonServiceInterceptor,
  pingInterceptor,
  updateCounterFileInterceptor,
} from '../../../../src/lib/github/interceptors';
import { GitLib } from '../../../../src/lib/github';
import { GithubLib } from '../../../../src/lib/github';
import { spawnAsyncProcess } from '../../../../src/utils/spawnProcess';
import { PrContext } from '../../../../src/types';
import dotenv from 'dotenv';
import { logger } from '../../../../src/utils/logger';
import { Octokit } from '@octokit/rest';

dotenv.config({ path: '.env.test.local' });

jest.mock('../../../../src/lib/github/git');
jest.mock('../../../../src/lib/github/github');
jest.mock('../../../../src/lib/github/interceptors', () => ({
  breakingChangesInterceptor: jest.fn(),
  interactionWithDummyJsonServiceInterceptor: jest.fn(),
  pingInterceptor: jest.fn(),
  updateCounterFileInterceptor: jest.fn(),
}));
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const event = {
  repository: {
    name: 'test-repo-name',
    owner: {
      login: 'test-owner',
    },
  },
  issue: {
    pull_request: {},
    number: 1,
  },
  sender: {
    login: 'test-sender-logic',
  },
} as IssueCommentEvent;

const Git = new GitLib(spawnAsyncProcess, logger);
const Github = new GithubLib(new Octokit({ auth: 'token' }), logger);

describe('prCommandHandler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('No interceptors is run if the event is generated from a comment posted on an Issue and not a PR', async () => {
    prCommandHandler({ ...event, issue: {} } as IssueCommentEvent, Github, Git).then(() => {
      expect(breakingChangesInterceptor).toHaveBeenCalledTimes(0);
      expect(interactionWithDummyJsonServiceInterceptor).toHaveBeenCalledTimes(0);
      expect(pingInterceptor).toHaveBeenCalledTimes(0);
      expect(updateCounterFileInterceptor).toHaveBeenCalledTimes(0);
    });
  });

  it('No interceptors is run if the event is generated from a comment posted by the GitHub App', async () => {
    await prCommandHandler({ ...event, sender: { login: process.env.GH_APP_NAME } } as IssueCommentEvent, Github, Git);

    expect(breakingChangesInterceptor).toHaveBeenCalledTimes(0);
    expect(interactionWithDummyJsonServiceInterceptor).toHaveBeenCalledTimes(0);
    expect(pingInterceptor).toHaveBeenCalledTimes(0);
    expect(updateCounterFileInterceptor).toHaveBeenCalledTimes(0);
  });

  it('When an error is thrown by an interceptor the exception is posted as a comment in the PR', async () => {
    (interactionWithDummyJsonServiceInterceptor as jest.Mock).mockImplementationOnce(() => {
      throw new Error('test error');
    });

    await prCommandHandler(event, Github, Git);

    expect(Github.postIssueCommentWithDetailsSection).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('All registered interceptors are called when the event is related to a comment posted on a PR and the sender is not the GitHub App', async () => {
    await prCommandHandler(event, Github, Git);
    const prContext: PrContext = {
      owner: event.repository.owner.login,
      repo: event.repository.name,
    };

    expect(breakingChangesInterceptor).toHaveBeenCalledTimes(1);
    expect(breakingChangesInterceptor).toHaveBeenCalledWith(Github, Git, prContext, event);
    expect(interactionWithDummyJsonServiceInterceptor).toHaveBeenCalledTimes(1);
    expect(interactionWithDummyJsonServiceInterceptor).toHaveBeenCalledWith(Github, Git, prContext, event);
    expect(pingInterceptor).toHaveBeenCalledTimes(1);
    expect(pingInterceptor).toHaveBeenCalledWith(Github, Git, prContext, event);
    expect(updateCounterFileInterceptor).toHaveBeenCalledTimes(1);
    expect(updateCounterFileInterceptor).toHaveBeenCalledWith(Github, Git, prContext, event);
  });
});
