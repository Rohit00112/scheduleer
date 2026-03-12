import { type NextRequest } from "next/server";
import jwt from "jsonwebtoken";

import { getDataSource } from "./db";
import { ApiError } from "./errors";
import { User, type UserRole } from "./entities";

const JWT_SECRET = process.env.JWT_SECRET || "scheduler-jwt-secret-key";

export interface AuthPayload {
  sub: number;
  username: string;
  role: UserRole;
}

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    instructorName: user.instructorName,
  };
}

export function buildTokenResponse(user: User) {
  const payload: AuthPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
  };

  return {
    accessToken: jwt.sign(payload, JWT_SECRET),
    user: sanitizeUser(user),
  };
}

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim() || null;
}

export function verifyAccessToken(token: string): AuthPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.sub !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string"
    ) {
      throw new ApiError(401, "Unauthorized");
    }

    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role as UserRole,
    };
  } catch {
    throw new ApiError(401, "Unauthorized");
  }
}

export async function requireAuth(request: NextRequest): Promise<AuthPayload> {
  const token = getBearerToken(request);
  if (!token) {
    throw new ApiError(401, "Unauthorized");
  }

  return verifyAccessToken(token);
}

export function requireRole(auth: AuthPayload, role: UserRole): void {
  if (auth.role !== role) {
    throw new ApiError(403, "Forbidden");
  }
}

export async function getAuthenticatedUser(request: NextRequest): Promise<{
  auth: AuthPayload;
  user: User;
}> {
  const auth = await requireAuth(request);
  const dataSource = await getDataSource();
  const user = await dataSource.getRepository(User).findOne({ where: { id: auth.sub } });

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  return { auth, user };
}
