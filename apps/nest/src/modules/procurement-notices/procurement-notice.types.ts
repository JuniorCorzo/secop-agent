export const PROCUREMENT_NOTICE_STATUSES = [
  'PENDING',
  'ENRICHING',
  'SCORING',
  'AWARDED',
  'REJECTED',
  'CANCELLED',
] as const;

export type ProcurementNoticeStatus = (typeof PROCUREMENT_NOTICE_STATUSES)[number];

export const PROCUREMENT_NOTICE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'publicationDate',
  'deadlineDate',
  'title',
  'status',
] as const;

export type ProcurementNoticeSortBy = (typeof PROCUREMENT_NOTICE_SORT_FIELDS)[number];

export const PROCUREMENT_NOTICE_SORT_ORDERS = ['ASC', 'DESC'] as const;

export type ProcurementNoticeSortOrder = (typeof PROCUREMENT_NOTICE_SORT_ORDERS)[number];

const PROCUREMENT_NOTICE_TRANSITIONS: Record<
  ProcurementNoticeStatus,
  readonly ProcurementNoticeStatus[]
> = {
  PENDING: ['ENRICHING'],
  ENRICHING: ['SCORING'],
  SCORING: ['AWARDED', 'REJECTED', 'CANCELLED'],
  AWARDED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const isProcurementNoticeStatus = (
  value: unknown,
): value is ProcurementNoticeStatus =>
  typeof value === 'string' && (PROCUREMENT_NOTICE_STATUSES as readonly string[]).includes(value);

export const canTransitionProcurementNoticeStatus = (
  currentStatus: ProcurementNoticeStatus | null | undefined,
  targetStatus: ProcurementNoticeStatus,
): boolean => {
  const normalizedCurrent = currentStatus ?? 'PENDING';

  if (normalizedCurrent === targetStatus) {
    return false;
  }

  return PROCUREMENT_NOTICE_TRANSITIONS[normalizedCurrent].includes(targetStatus);
};
