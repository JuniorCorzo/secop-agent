## ADDED Requirements

### Requirement: Extended Company Profile Fields
The system SHALL persist extended profile fields on the `Company` entity, including `targetTicket`, `workingCapital`, `annualRevenue`, `excludedContractTypes`, `excludedModalities`, and `unspscMatchPolicy` to enable matching and exclusion logic.

#### Scenario: Save extended company profile information
- **WHEN** a company profile is updated with target ticket, working capital, and exclusions list
- **THEN** the database SHALL store these values and return them in subsequent reads

### Requirement: Company Historical Contract Tracking
The system SHALL persist `CompanyContract` records associated with a `Company` to store details of their past contracting experience including descriptions, client NIT, value, status, and UNSPSC codes.

#### Scenario: Register completed contract for experience scoring
- **WHEN** a new historical contract record with status `LIQUIDADO` and UNSPSC code is added to a company
- **THEN** the system SHALL store the contract record linked to the company
