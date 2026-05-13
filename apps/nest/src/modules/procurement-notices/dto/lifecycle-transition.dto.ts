import { IsIn, IsString } from 'class-validator';
import { PROCUREMENT_NOTICE_STATUSES } from '../procurement-notice.types';

export class LifecycleTransitionDto {
  @IsString()
  @IsIn(PROCUREMENT_NOTICE_STATUSES)
  targetStatus: (typeof PROCUREMENT_NOTICE_STATUSES)[number];
}
