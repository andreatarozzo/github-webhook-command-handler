import { IssueCommentEvent } from '@octokit/webhooks-types';
import { Interceptor, PrContext } from '../../../types';
import { logger } from '../../../utils';
import { GithubLib } from '../github';
import { GitLib } from '../git';
import {
  pingInterceptor,
  updateCounterFileInterceptor,
  breakingChangesInterceptor,
  interactionWithDummyJsonServiceInterceptor,
} from '../interceptors';

// Registering the available interceptors or the interceptors associated with this specific handler
const interceptors: Interceptor[] = Object.seal([
  breakingChangesInterceptor,
  pingInterceptor,
  updateCounterFileInterceptor,
  interactionWithDummyJsonServiceInterceptor,
]);

export const prCommandHandler = async (payload: IssueCommentEvent, github: GithubLib, git: GitLib) => {
  // Because the issue_comment event related both for PR and Issue comment, accepting only
  // events that have been generated in a PR
  if (!payload.issue.pull_request || payload.sender.login.includes(process.env.GH_APP_NAME!)) {
    return;
  }

  const prContext: PrContext = { owner: payload.repository.owner.login, repo: payload.repository.name };

  // Using a for loop with await to maintain the order of operations.
  // If the order of the interceptors execution is not a concern, .forEach can be used which
  // execute the asynchronous operations concurrently without waiting for the previous one to complete at the expense of
  // a ordered execution.
  for (var interceptor of interceptors) {
    try {
      // Iterating thought the interceptors, those who accepts the command will execute their logic.
      // In this way it is possible to have multiple interceptors that can accept a single command.
      await interceptor(github, git, prContext, payload);
    } catch (e: any) {
      logger.error(e.message);

      await github.postIssueCommentWithDetailsSection({
        ...prContext,
        issue_number: payload.issue.number,
        header: `Something went wrong while executing ${interceptor.name}`,
        detailsSectionTitle: 'Error',
        detailSectionBody: e.message,
      });
    }
  }
};
