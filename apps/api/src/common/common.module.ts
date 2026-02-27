import { Global, Module } from "@nestjs/common";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RolesGuard } from "./guards/roles.guard";

@Global()
@Module({
  providers: [JwtAuthGuard, RolesGuard, PermissionsGuard],
  exports: [JwtAuthGuard, RolesGuard, PermissionsGuard]
})
export class CommonModule {}
