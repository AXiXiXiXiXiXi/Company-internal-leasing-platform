import { UserRole } from './enums';

export interface AuthenticatedUser {
  id: string;
  username: string;
  employeeNo: string | null;
  fullName: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  exp?: number;
  iat?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
