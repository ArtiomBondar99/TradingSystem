import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.js';

/**
 * Injects the authenticated user (set by JwtAuthGuard) into a controller method.
 *   @CurrentUser() user: AuthenticatedUser
 *   @CurrentUser('userId') userId: string
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;

    return field ? user[field] : user;
  },
);
