import { UserRole } from '../entities/user.entity';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
  user: UserProfile;
}

export interface JwtPayload {
  sub: string;
  email?: string;
}
