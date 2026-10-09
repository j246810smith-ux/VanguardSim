/** Structured engine errors. Never fail silently: every error says what was attempted and why. */
export class EngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class IllegalActionError extends EngineError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('ILLEGAL_ACTION', message, details);
  }
}

export class InvalidZoneError extends EngineError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('INVALID_ZONE', message, details);
  }
}

export class CardDefinitionError extends EngineError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('CARD_DEFINITION', message, details);
  }
}

export class DeckValidationError extends EngineError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('DECK_INVALID', message, details);
  }
}
