import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { RealtimePublisher } from "../realtime/realtime.publisher";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly realtimePublisher: RealtimePublisher
  ) {}

  @Get("overview")
  overview() {
    return this.adminService.overview();
  }

  @Get("analytics/lecturers")
  async lecturerAnalytics(@Query("from") from?: string, @Query("to") to?: string) {
    const data = await this.adminService.lecturerAnalytics(from, to);
    await this.realtimePublisher.publishAnalytics("analytics.refreshed", {
      generatedAt: new Date().toISOString(),
      type: "lecturers"
    });
    return data;
  }

  @Get("analytics/rooms")
  async roomAnalytics(@Query("from") from?: string, @Query("to") to?: string) {
    const data = await this.adminService.roomAnalytics(from, to);
    await this.realtimePublisher.publishAnalytics("analytics.refreshed", {
      generatedAt: new Date().toISOString(),
      type: "rooms"
    });
    return data;
  }
}
