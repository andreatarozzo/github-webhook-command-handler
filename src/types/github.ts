import { IssueCommentEvent } from '@octokit/webhooks-types';
import { GitLib, GithubLib } from '../lib/github';

export enum CommentCommand {
  Ping = 'command ping',
  BreakingChanges = 'command breaking-changes',
  UpdateCounterFile = 'command update counter file',
  InteractWithDummyJson = 'command dummy json service',
}

export type CommentReaction = '+1' | '-1' | 'eyes' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket';

export type PrContext = {
  owner: string;
  repo: string;
};

export type Interceptor = (
  github: GithubLib,
  git: GitLib,
  context: PrContext,
  event: IssueCommentEvent,
) => Promise<void>;
