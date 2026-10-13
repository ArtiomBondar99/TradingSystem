// Named fields instead of positional params: create(email, firstName, lastName, hash)
// would let firstName and lastName be swapped without any compiler error.
export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}
