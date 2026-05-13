export const QUEUE_NAMES = {
  PROCUREMENT_NOTICE_INGESTION: 'procurement-notice-ingestion',
  SCORING: 'scoring',
  ALERTS: 'alerts',
  DOCUMENT_PROCESSING: 'document-processing',
  EXAMPLE: 'example',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
