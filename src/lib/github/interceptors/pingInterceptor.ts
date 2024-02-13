import { IssueCommentEvent } from '@octokit/webhooks-types';
import { CommentCommand, Interceptor, PrContext } from '../../../types';
import { logger } from '../../../utils';
import { GithubLib } from '../github';
import { GitLib } from '../git';

export const pingInterceptor: Interceptor = async (
  github: GithubLib,
  _: GitLib,
  context: PrContext,
  event: IssueCommentEvent,
) => {
  if (event.comment.body?.trim() !== CommentCommand.Ping) {
    logger.info(`Ping interceptor - COMMAND FROM COMMENT_ID: ${event.comment.id} - REJECTED`);
    return;
  }

  logger.info(`Ping interceptor - COMMAND FROM COMMENT_ID: ${event.comment.id} - ACCEPTED`);

  await github.postIssueCommentReaction({
    ...context,
    content: 'eyes',
    comment_id: event.comment.id,
  });

  await github.postIssueComment({
    ...context,
    body: `Ready to accept commands!`,
    issue_number: event.issue.number,
  });
};
