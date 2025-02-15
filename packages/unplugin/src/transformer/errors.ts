export interface ErrorDetail {
  message: string;
  line: number;
  column: number;
}

/**
 * Custom error class for transformation errors.
 */
export class TransformationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransformationError";
  }
}

/**
 * Custom error class for parsing errors.
 */
export class ParsingError extends TransformationError {
  public errors: ErrorDetail[];
  constructor(message: string, errors: ErrorDetail[]) {
    super(message);
    this.name = "ParsingError";
    this.errors = errors;
  }
}
