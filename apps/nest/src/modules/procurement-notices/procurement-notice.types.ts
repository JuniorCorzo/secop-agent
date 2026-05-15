/**
 * Origin dataset for a procurement notice.
 * SECOP_I = awarded/signed contracts (historical intelligence, f789-7hwg).
 * SECOP_II = active procurement processes (opportunity pipeline, p6dx-8zbt).
 */
export const PROCUREMENT_NOTICE_SOURCES = ['SECOP_I', 'SECOP_II'] as const;
export type ProcurementNoticeSource = (typeof PROCUREMENT_NOTICE_SOURCES)[number];

/**
 * Valid lifecycle states for a procurement notice.
 *
 * Lifecycle progression:
 * ```
 * PENDING → ENRICHING → SCORING → AWARDED | REJECTED | CANCELLED
 * ```
 * Terminal states (`AWARDED`, `REJECTED`, `CANCELLED`) have no outgoing transitions.
 *
 * @see procnotices-spec - Lifecycle Progression
 */
export const PROCUREMENT_NOTICE_STATUSES = [
  'PENDING',
  'ENRICHING',
  'SCORING',
  'AWARDED',
  'REJECTED',
  'CANCELLED',
] as const;

/** Union type of all valid procurement notice lifecycle states. */
export type ProcurementNoticeStatus = (typeof PROCUREMENT_NOTICE_STATUSES)[number];

/** Columns that can be used for sorting in search queries. */
export const PROCUREMENT_NOTICE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'publicationDate',
  'deadlineDate',
  'awardedDate',
  'value',
  'awardedValue',
  'title',
  'status',
] as const;

/** Valid sort column identifiers for procurement notice queries. */
export type ProcurementNoticeSortBy = (typeof PROCUREMENT_NOTICE_SORT_FIELDS)[number];

/** Sort order directions. */
export const PROCUREMENT_NOTICE_SORT_ORDERS = ['ASC', 'DESC'] as const;

/** Valid sort order direction for procurement notice queries. */
export type ProcurementNoticeSortOrder = (typeof PROCUREMENT_NOTICE_SORT_ORDERS)[number];

/**
 * Allowed transitions between lifecycle states.
 * Terminal states map to an empty array — no transitions out.
 */
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

/**
 * Type guard: checks whether a runtime value is a valid `ProcurementNoticeStatus`.
 *
 * @param value - Any runtime value (typically from a DB row or unvalidated input).
 * @returns `true` if `value` is one of the known status strings.
 */
export const isProcurementNoticeStatus = (
  value: unknown,
): value is ProcurementNoticeStatus =>
  typeof value === 'string' && (PROCUREMENT_NOTICE_STATUSES as readonly string[]).includes(value);

/**
 * Checks whether transitioning from `currentStatus` to `targetStatus` is allowed.
 *
 * - `null` or `undefined` current status is normalized to `'PENDING'`.
 * - Self-transitions (same → same) always return `false`.
 * - Terminal states always return `false` for any target.
 *
 * @param currentStatus - The notice's current lifecycle state, or `null`/`undefined`.
 * @param targetStatus  - The desired next state.
 * @returns `true` if the transition is valid according to `PROCUREMENT_NOTICE_TRANSITIONS`.
 *
 * @see procnotices-spec - Lifecycle Progression
 */
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
