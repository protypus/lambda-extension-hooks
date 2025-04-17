// lib/errors.js - Custom error handling
/**
 * Custom error class for Lambda hooks
 */
export class LambdaHookError extends Error {
    /**
     * Create a new LambdaHookError
     * @param {string} code - Error code
     * @param {string} message - Error message
     * @param {Error|Object} [cause] - Original error or additional data
     * @param {boolean} [isFatal=false] - Whether this error is fatal
     */
    constructor(code, message, cause, isFatal = false) {
      super(message);
      this.name = 'LambdaHookError';
      this.code = code;
      this.cause = cause;
      this.isFatal = isFatal;
      
      // Capture stack trace
      Error.captureStackTrace(this, this.constructor);
    }
  }