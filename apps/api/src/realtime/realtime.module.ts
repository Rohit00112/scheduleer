import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimePublisherModule } from "./realtime-publisher.module";
import { RealtimeSubscriber } from "./realtime.subscriber";

@Module({
  imports: [JwtModule.register({}), RealtimePublisherModule],
  providers: [RealtimeGateway, RealtimeSubscriber],
  exports: [RealtimeGateway, RealtimePublisherModule]
})
export class RealtimeModule {}
