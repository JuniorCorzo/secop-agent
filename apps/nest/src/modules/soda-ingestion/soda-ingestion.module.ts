import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProcurementNoticesModule } from "../procurement-notices/procurement-notices.module";
import { IngestionJob } from "../procurement-notices/entities/ingestion-job.entity";
import { ProcurementNotice } from "../procurement-notices/entities/procurement-notice.entity";
import { IngestionState } from "./entities/ingestion-state.entity";
import { QueuesModule } from "../queues/queues.module";
import { SodaClientService } from "./services/soda-client.service";
import { SodaIngestionService } from "./services/soda-ingestion.service";
import { SodaStreamerService } from "./services/soda-streamer.service";

@Module({
	imports: [
		ScheduleModule.forRoot(),
		HttpModule,
		ProcurementNoticesModule,
		TypeOrmModule.forFeature([IngestionJob, IngestionState, ProcurementNotice]),
		QueuesModule,
	],
	providers: [SodaClientService, SodaIngestionService, SodaStreamerService],
	exports: [SodaClientService, SodaIngestionService, SodaStreamerService],
})
export class SodaIngestionModule {}
