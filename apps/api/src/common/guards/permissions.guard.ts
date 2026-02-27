import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaService: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { id?: string; role?: string } }>();
    if (!request.user?.id || !request.user.role) {
      throw new ForbiddenException("User context is missing");
    }

    const matchedPermissionCount = await this.prismaService.rolePermission.count({
      where: {
        role: request.user.role as never,
        permission: {
          key: {
            in: requiredPermissions
          }
        }
      }
    });

    if (matchedPermissionCount < requiredPermissions.length) {
      throw new ForbiddenException("Missing required permission");
    }

    return true;
  }
}
