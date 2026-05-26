## ADDED Requirements

### Requirement: Provider-agnostic LLM Client Abstraction
The system SHALL define a provider-agnostic interface `LlmProvider` that abstracts LLM tasks such as chat completions, embeddings generation, and health check.

#### Scenario: Chat Completion Request
- **WHEN** a client calls the `chat` method of `LlmProvider` with valid messages and options
- **THEN** the system SHALL return a chat response containing the text content and optionally token usage metrics

#### Scenario: Embeddings Generation Request
- **WHEN** a client calls the `embed` method of `LlmProvider` with a list of text strings
- **THEN** the system SHALL return a list of numerical vectors representing the text embeddings

#### Scenario: LLM Health Status Check
- **WHEN** a client calls the `health` method of `LlmProvider`
- **THEN** the system SHALL query the underlying service's health endpoint and return true if healthy, or false otherwise

### Requirement: OpenCodeGo OpenAI-compatible Adapter
The system SHALL implement an `OpenCodeGoProvider` adapter that communicates with the Go LLM microservice or local Ollama instance using standard OpenAI-compatible HTTP endpoints.

#### Scenario: Successful Chat API Call
- **WHEN** `OpenCodeGoProvider.chat` is invoked
- **THEN** the system SHALL issue a POST request to `/v1/chat/completions` with the bearer authorization token header and message payload
- **AND** parse the standard chat completion response format

#### Scenario: Successful Embeddings API Call
- **WHEN** `OpenCodeGoProvider.embed` is invoked
- **THEN** the system SHALL issue a POST request to `/v1/embeddings` with the bearer authorization token header and input text payload
- **AND** parse the standard embeddings array response

### Requirement: Resilient LLM Scoring Degradation
The system SHALL handle LLM service failures (timeouts, HTTP errors, service unavailability) gracefully during the scoring flow without failing the notice evaluation.

#### Scenario: LLM Failure Falls Back to Rule-Based Narrative
- **WHEN** `OpenCodeGoProvider.chat` throws an error or times out during scoring
- **THEN** the system SHALL catch the exception, log a warning, and fall back to using the basic rule-based justification for the scoring explanation
- **AND** the evaluation process SHALL complete successfully
