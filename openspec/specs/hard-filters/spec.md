# hard-filters Specification

## Purpose
TBD - created by archiving change sprint3-scoring-engine. Update Purpose after archive.
## Requirements
### Requirement: Financial Capacity Filter
The system SHALL exclude a procurement notice if the notice value exceeds the company's registered maximum contracting capacity.

#### Scenario: Notice value exceeds maximum contracting capacity
- **WHEN** a notice is evaluated and its budget value is greater than the company's maximum contracting capacity
- **THEN** the system SHALL exclude the notice and log the financial capacity failure

### Requirement: Residual Capacity Validation
For public works contracts (`Obra`), the system SHALL calculate the required residual capacity and exclude the notice if it exceeds the company's net available residual capacity ($K_R$), computed as Flujo de Caja de Contratación ($FCC$) minus Saldo de Contratos en Ejecución ($SCE$).

#### Scenario: Notice required residual capacity exceeds available residual capacity
- **WHEN** a notice has contract type `Obra` and the required residual capacity is greater than the company's calculated net available residual capacity ($K_R$)
- **THEN** the system SHALL exclude the notice and log the residual capacity failure

### Requirement: Sector Hierarchy Filter
The system SHALL validate the notice's UNSPSC code against the company's authorized UNSPSC codes using either strict mode (matching at the Class level / first 6 digits) or flexible mode (matching at the Family level / first 4 digits).

#### Scenario: UNSPSC mismatch under strict mode
- **WHEN** strict matching policy is active and the first 6 digits of the notice's UNSPSC code do not match any of the company's authorized UNSPSC codes
- **THEN** the system SHALL exclude the notice and log the sector mismatch failure

### Requirement: Geographic Coverage Intersect
The system SHALL exclude a notice if its execution location (normalized to DANE DIVIPOLA codes) does not overlap with the company's registered regions of coverage.

#### Scenario: Location is outside company coverage regions
- **WHEN** the normalized execution department DIVIPOLA code does not exist in the company's list of coverage regions
- **THEN** the system SHALL exclude the notice and log the geographic mismatch failure

### Requirement: Excluded Modality and Contract Type Filter
The system SHALL exclude a notice if its contracting modality or contract type is listed in the company's blacklisted modalities or contract types.

#### Scenario: Notice modality is blacklisted by company
- **WHEN** the notice's contracting modality exists in the company's list of excluded modalities
- **THEN** the system SHALL exclude the notice and log the modality exclusion failure

### Requirement: Active Notice Deadline Validation
For active SECOP II opportunities, the system SHALL exclude the notice if the current server time is past the notice deadline date.

#### Scenario: Evaluation time is past the notice deadline
- **WHEN** the notice source is `SECOP_II` and the current server timestamp is greater than the notice deadline date
- **THEN** the system SHALL exclude the notice and log the deadline expiration failure

