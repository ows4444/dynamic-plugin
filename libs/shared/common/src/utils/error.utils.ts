/**
 * Utility functions for safe error handling
 */

/**
 * Safely extracts an error message from unknown error types
 */
export function getErrorMessage(error: unknown, defaultMessage='Unknown error' ): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return defaultMessage;
}

/**
 * Safely extracts an error code from unknown error types
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return undefined;
}

/**
 * Safely extracts an error stack from unknown error types
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  if (error !== null && typeof error === 'object' && 'stack' in error) {
    const stack = (error as { stack: unknown }).stack;
    if (typeof stack === 'string') {
      return stack;
    }
  }
  return undefined;
}

/**
 * Checks if an error is a NodeJS system error with a code
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Type guard to check if value is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}