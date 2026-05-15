export class NewProcurementNoticeEvent {
  static readonly EVENT_NAME = 'procurement-notice.persisted';

  readonly ingestionJobId: string;
  readonly procurementNoticeId: string;
  readonly secopId: string;
  readonly action: 'created' | 'updated';

  constructor(payload: {
    ingestionJobId: string;
    procurementNoticeId: string;
    secopId: string;
    action: 'created' | 'updated';
  }) {
    this.ingestionJobId = payload.ingestionJobId;
    this.procurementNoticeId = payload.procurementNoticeId;
    this.secopId = payload.secopId;
    this.action = payload.action;
  }
}
