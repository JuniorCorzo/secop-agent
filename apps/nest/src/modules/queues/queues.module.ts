import { Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Worker } from "bullmq";
import { QUEUE_NAMES } from "./constants/queue-names";
import { ExampleQueueProducer } from "./producers/example-queue.producer";
import { ExampleQueueWorker } from "./workers/example-queue.worker";
import { ProcurementIngestionProducer } from "./producers/procurement-ingestion.producer";
import { ScoringDispatchProducer } from "./producers/scoring-dispatch.producer";
import { IngestionJob } from "../procurement-notices/entities/ingestion-job.entity";
import { ProcurementNotice } from "../procurement-notices/entities/procurement-notice.entity";

/** Token for the sandboxed procurement ingestion worker instance. */
export const PROCUREMENT_INGESTION_WORKER = "PROCUREMENT_INGESTION_WORKER";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>("REDIS_HOST") ?? "localhost",
          port: configService.get<number>("REDIS_PORT") ?? 6379,
          password: configService.get<string>("REDIS_PASSWORD") ?? undefined,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EXAMPLE },
      { name: QUEUE_NAMES.PROCUREMENT_NOTICE_INGESTION },
      { name: QUEUE_NAMES.SCORING },
    ),
    TypeOrmModule.forFeature([ProcurementNotice, IngestionJob]),
  ],
  providers: [
    ExampleQueueProducer,
    ExampleQueueWorker,
    ProcurementIngestionProducer,
    ScoringDispatchProducer,
    // ── Sandboxed procurement ingestion worker ──────────────
    {
      provide: PROCUREMENT_INGESTION_WORKER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Worker => {
        const logger = new Logger("ProcurementIngestionWorker");

        const worker = new Worker(
          QUEUE_NAMES.PROCUREMENT_NOTICE_INGESTION,
          // Bun executes TypeScript natively — pass the .ts file directly
          require("path").join(__dirname, "processors", "import-processor.js"),
          {
            connection: {
              host: configService.get<string>("REDIS_HOST") ?? "localhost",
              port: configService.get<number>("REDIS_PORT") ?? 6379,
              password:
                configService.get<string>("REDIS_PASSWORD") ?? undefined,
              maxRetriesPerRequest: null,
            },
            useWorkerThreads: true, // Bun-native worker threads (JSC)
            concurrency: 5,
          },
        );

        worker.on("completed", (job, result) => {
          logger.log(
            `Job ${job.id} completed: created=${result?.created} updated=${result?.updated} failed=${result?.failed}`,
          );
        });

        worker.on("failed", (job, error) => {
          logger.error(`Job ${job?.id} failed: ${error.message}`);
        });

        return worker;
      },
    },
  ],
  exports: [
    BullModule,
    ExampleQueueProducer,
    ProcurementIngestionProducer,
    ScoringDispatchProducer,
  ],
})
export class QueuesModule implements OnApplicationShutdown {
  private readonly logger = new Logger(QueuesModule.name);

  // Note: NestJS does not support @Inject() with string tokens in constructor
  // of a @Module() class. The worker shutdown is handled by BullMQ's own
  // lifecycle via the connection closing. The factory-created worker will
  // be garbage-collected when the module is destroyed, which triggers
  // BullMQ's internal cleanup.
  //
  // For explicit graceful shutdown, override OnApplicationShutdown
  // and access the worker via the module's provider registry.
  async onApplicationShutdown(): Promise<void> {
    this.logger.log(
      "QueuesModule shutting down — BullMQ workers will close with their Redis connections",
    );
    // BullModule handles worker cleanup automatically on application shutdown.
  }
}
