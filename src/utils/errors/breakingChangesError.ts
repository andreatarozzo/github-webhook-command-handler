export class BreakingChangesError extends Error {
  name = 'BreakingChangesError';
  message!: string;

  constructor(message: string) {
    super(message);
    this.message = message;
  }
}
