import { IssueCommentEvent } from '@octokit/webhooks-types';
import { CommentCommand, Interceptor, PrContext } from '../../../types';
import { logger } from '../../../utils';
import { GithubLib } from '../github';
import { GitLib } from '../git';
import axios from 'axios';

export const interactionWithDummyJsonServiceInterceptor: Interceptor = async (
  github: GithubLib,
  _: GitLib,
  context: PrContext,
  event: IssueCommentEvent,
) => {
  if (event.comment.body?.trim() !== CommentCommand.InteractWithDummyJson) {
    logger.info(
      `Interact with dummy json service interceptor - COMMAND FROM COMMENT_ID: ${event.comment.id} - REJECTED`,
    );
    return;
  }

  logger.info(`Interact with dummy json service interceptor - COMMAND FROM COMMENT_ID: ${event.comment.id} - ACCEPTED`);

  // Posting a reaction to the comment that triggered the interceptor as acknowledgement
  await github.postIssueCommentReaction({
    ...context,
    content: 'eyes',
    comment_id: event.comment.id,
  });

  // Interacting with other service
  const response = await axios.get('https://dummyjson.com/todos/random');

  // Posting the result
  await github.postIssueCommentWithDetailsSection({
    ...context,
    issue_number: event.issue.number,
    header: 'The dummy json service provided this random TODO tasks for you',
    detailsSectionTitle: 'TODO Details',
    detailSectionBody: JSON.stringify(response.data, null, 2),
    footer: `That's it!`,
  });
};
