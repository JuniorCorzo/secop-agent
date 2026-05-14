import { PartialType } from '@nestjs/swagger';
import { CreateProcurementNoticeDto } from './create-procurement-notice.dto';

/**
 * Input DTO for partial updates to a procurement notice.
 *
 * All fields are optional — only provided fields are merged into the existing entity.
 * If `status` is provided, the transition is validated via
 * {@link canTransitionProcurementNoticeStatus} and rejected with `400 Bad Request`
 * if invalid.
 *
 * @see procnotices-spec - CRUD Access
 */
export class UpdateProcurementNoticeDto extends PartialType(CreateProcurementNoticeDto) {}
