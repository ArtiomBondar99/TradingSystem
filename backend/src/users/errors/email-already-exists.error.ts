export class EmailAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Email already exists: ${email}`);
    this.name = 'EmailAlreadyExistsError';
  }
}
