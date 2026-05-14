import { IsIn, IsString } from 'class-validator';
import { PROCUREMENT_NOTICE_STATUSES } from '../procurement-notice.types';

/**
 * DTO for advancing a procurement notice to the next lifecycle state.
 *
 * The transition is validated server-side by
 * {@link canTransitionProcurementNoticeStatus}. Self-transitions and
 * transitions from terminal states are rejected with `400 Bad Request`.
 *
 * @see procnotices-spec - Lifecycle Progression
 */
export class LifecycleTransitionDto {
  /** Desired target lifecycle state. Must be a valid {@link ProcurementNoticeStatus}. */
  @IsString()
  @IsIn(PROCUREMENT_NOTICE_STATUSES)
  targetStatus: (typeof PROCUREMENT_NOTICE_STATUSES)[number];
}
