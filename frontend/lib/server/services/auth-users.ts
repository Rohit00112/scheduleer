import { compare, hash } from "bcryptjs";

import { buildTokenResponse, sanitizeUser, type AuthPayload } from "../auth";
import { ApiError } from "../errors";
import { UserRole } from "../entities";
import type {
  ChangePasswordInput,
  CreateUserInput,
  LoginInput,
} from "../validation";
import { getRepositories } from "./repositories";

export function generateUsername(instructorName: string): string {
  return instructorName
    .replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
}

export async function loginUser(input: LoginInput) {
  const { userRepo } = await getRepositories();
  const user = await userRepo.findOne({ where: { username: input.username } });
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const valid = await compare(input.password, user.password);
  if (!valid) {
    throw new ApiError(401, "Invalid credentials");
  }

  return buildTokenResponse(user);
}

export async function changeUserPassword(auth: AuthPayload, input: ChangePasswordInput) {
  const { userRepo } = await getRepositories();
  const user = await userRepo.findOne({ where: { id: auth.sub } });

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  if (user.mustChangePassword && !input.currentPassword) {
    // Allow forced password changes without a current password.
  } else {
    if (!input.currentPassword) {
      throw new ApiError(401, "Current password is required");
    }

    const valid = await compare(input.currentPassword, user.password);
    if (!valid) {
      throw new ApiError(401, "Current password is incorrect");
    }
  }

  user.password = await hash(input.newPassword, 10);
  user.mustChangePassword = false;
  await userRepo.save(user);

  return buildTokenResponse(user);
}

export async function findUserById(id: number) {
  const { userRepo } = await getRepositories();
  return userRepo.findOne({ where: { id } });
}

export async function listUsers() {
  const { userRepo } = await getRepositories();
  const users = await userRepo.find({ order: { id: "ASC" } });
  return users.map(sanitizeUser);
}

export async function createUser(input: CreateUserInput) {
  const { userRepo } = await getRepositories();
  const existing = await userRepo.findOne({ where: { username: input.username } });
  if (existing) {
    throw new ApiError(409, "Username already exists");
  }

  const saved = await userRepo.save(
    userRepo.create({
      username: input.username,
      password: await hash(input.password, 10),
      role: input.role || UserRole.USER,
      mustChangePassword: (input.role || UserRole.USER) === UserRole.INSTRUCTOR,
      instructorName: input.instructorName || null,
    }),
  );

  return sanitizeUser(saved);
}

export async function updateUserRole(id: number, role: UserRole) {
  const { userRepo } = await getRepositories();
  const user = await userRepo.findOne({ where: { id } });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.role = role;
  const saved = await userRepo.save(user);
  return sanitizeUser(saved);
}

export async function resetUserPassword(id: number, password: string) {
  const { userRepo } = await getRepositories();
  const user = await userRepo.findOne({ where: { id } });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.password = await hash(password, 10);
  await userRepo.save(user);

  return { success: true };
}

export async function deleteUser(id: number) {
  const { userRepo } = await getRepositories();
  const user = await userRepo.findOne({ where: { id } });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await userRepo.remove(user);
  return { success: true };
}
