# enrichment-pipeline Specification

## Purpose

Provide deterministic, lightweight enrichment capabilities for procurement notices, including NIT normalization, static geolocation mapping for Colombian departments, and duration/value metrics calculation.

## Requirements

### Requirement: NIT Normalization

The system MUST normalize entity tax identifiers (`entityNit`) and awarded contractor tax identifiers (`awardedContractorNit`) by removing non-alphanumeric characters (specifically dots, hyphens, and spaces).

#### Scenario: Normalize NIT with special characters
- GIVEN a raw procurement record with `entityNit` "800.197.268-4" and `awardedContractorNit` "901-234 567"
- WHEN the record is processed for enrichment
- THEN the normalized `entityNit` is "8001972684"
- AND the normalized `awardedContractorNit` is "901234567"

### Requirement: Geolocation Mapping

The system MUST resolve latitude and longitude coordinates for Colombian departments during notice enrichment using a local, static lookup. If the department is not recognized, coordinates MUST fall back to `null`.

#### Scenario: Geolocate recognized Colombian department
- GIVEN a raw procurement record with execution department "Cundinamarca"
- WHEN the record is processed for enrichment
- THEN the resolved coordinates are latitude `4.7110` and longitude `-74.0721`

#### Scenario: Fallback for unrecognized department
- GIVEN a raw procurement record with execution department "Atlantis"
- WHEN the record is processed for enrichment
- THEN the resolved coordinates are latitude `null` and longitude `null`

### Requirement: Ingestion Metrics Calculation

The system MUST compute execution duration (in days) and value per day metrics for notice records when both publication and deadline dates are present and valid.

#### Scenario: Calculate duration and value metrics
- GIVEN a raw procurement record with `publicationDate` "2026-05-01", `deadlineDate` "2026-05-11", and `value` `1000000.00`
- WHEN the record is processed for enrichment
- THEN the calculated execution duration is `10` days
- AND the calculated value per day is `100000.00`
