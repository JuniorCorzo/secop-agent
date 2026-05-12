import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserProfile } from '../types/auth.types';

export const CurrentUser = createParamDecorator((data: keyof UserProfile | undefined, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ user?: UserProfile }>();
  const user = request.user;

  if (!data) {
    return user;
  }

  return user?.[data];
});
