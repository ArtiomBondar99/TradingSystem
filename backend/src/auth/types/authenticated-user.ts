// What JwtStrategy.validate() puts on request.user for authenticated requests
export interface AuthenticatedUser {
  userId: string;
  email: string;
}

// The claims we sign into the JWT
export interface JwtPayload {
  sub: string;
  email: string;
}
