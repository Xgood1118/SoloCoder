"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkError = exports.errorCategories = exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorCode["CONNECTION_TIMEOUT"] = "CONNECTION_TIMEOUT";
    ErrorCode["REQUEST_TIMEOUT"] = "REQUEST_TIMEOUT";
    ErrorCode["RETRY_TIMEOUT"] = "RETRY_TIMEOUT";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    ErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorCode["BAD_GATEWAY"] = "BAD_GATEWAY";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["GATEWAY_TIMEOUT"] = "GATEWAY_TIMEOUT";
    ErrorCode["CONFIG_ERROR"] = "CONFIG_ERROR";
    ErrorCode["POOL_EXHAUSTED"] = "POOL_EXHAUSTED";
    ErrorCode["POOL_TIMEOUT"] = "POOL_TIMEOUT";
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
exports.errorCategories = {
    [ErrorCode.NETWORK_ERROR]: {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network connection error occurred',
        retryable: true,
    },
    [ErrorCode.CONNECTION_TIMEOUT]: {
        code: ErrorCode.CONNECTION_TIMEOUT,
        message: 'Connection timed out while establishing connection',
        retryable: true,
    },
    [ErrorCode.REQUEST_TIMEOUT]: {
        code: ErrorCode.REQUEST_TIMEOUT,
        message: 'Request timed out while waiting for response',
        retryable: true,
    },
    [ErrorCode.RETRY_TIMEOUT]: {
        code: ErrorCode.RETRY_TIMEOUT,
        message: 'All retry attempts exhausted',
        retryable: false,
    },
    [ErrorCode.VALIDATION_ERROR]: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request parameters validation failed',
        retryable: false,
    },
    [ErrorCode.UNAUTHORIZED]: {
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authentication required or invalid credentials',
        retryable: false,
    },
    [ErrorCode.FORBIDDEN]: {
        code: ErrorCode.FORBIDDEN,
        message: 'Insufficient permissions to access the resource',
        retryable: false,
    },
    [ErrorCode.NOT_FOUND]: {
        code: ErrorCode.NOT_FOUND,
        message: 'Requested resource not found',
        retryable: false,
    },
    [ErrorCode.CONFLICT]: {
        code: ErrorCode.CONFLICT,
        message: 'Resource conflict detected',
        retryable: false,
    },
    [ErrorCode.RATE_LIMITED]: {
        code: ErrorCode.RATE_LIMITED,
        message: 'Rate limit exceeded',
        retryable: true,
    },
    [ErrorCode.INTERNAL_SERVER_ERROR]: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Internal server error occurred',
        retryable: true,
    },
    [ErrorCode.BAD_GATEWAY]: {
        code: ErrorCode.BAD_GATEWAY,
        message: 'Bad gateway error from upstream service',
        retryable: true,
    },
    [ErrorCode.SERVICE_UNAVAILABLE]: {
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'Service is temporarily unavailable',
        retryable: true,
    },
    [ErrorCode.GATEWAY_TIMEOUT]: {
        code: ErrorCode.GATEWAY_TIMEOUT,
        message: 'Gateway timeout from upstream service',
        retryable: true,
    },
    [ErrorCode.CONFIG_ERROR]: {
        code: ErrorCode.CONFIG_ERROR,
        message: 'Configuration error occurred',
        retryable: false,
    },
    [ErrorCode.POOL_EXHAUSTED]: {
        code: ErrorCode.POOL_EXHAUSTED,
        message: 'Connection pool is exhausted',
        retryable: true,
    },
    [ErrorCode.POOL_TIMEOUT]: {
        code: ErrorCode.POOL_TIMEOUT,
        message: 'Timed out while waiting for connection from pool',
        retryable: true,
    },
    [ErrorCode.UNKNOWN_ERROR]: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'An unknown error occurred',
        retryable: false,
    },
};
class SdkError extends Error {
    constructor(code, message, options = {}) {
        const category = exports.errorCategories[code];
        super(message || category.message);
        this.name = 'SdkError';
        this.code = code;
        this.retryable = category.retryable;
        this.statusCode = options.statusCode;
        this.requestId = options.requestId;
        this.details = options.details;
        this.cause = options.cause;
        this.timestamp = new Date().toISOString();
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SdkError);
        }
    }
    isRetryable() {
        return this.retryable;
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            retryable: this.retryable,
            statusCode: this.statusCode,
            requestId: this.requestId,
            details: this.details,
            cause: this.cause?.message,
            timestamp: this.timestamp,
            stack: this.stack,
        };
    }
    toString() {
        return `[${this.code}] ${this.message}${this.requestId ? ` (requestId: ${this.requestId})` : ''}`;
    }
    static fromHttpStatus(statusCode, message) {
        let code;
        switch (statusCode) {
            case 400:
                code = ErrorCode.VALIDATION_ERROR;
                break;
            case 401:
                code = ErrorCode.UNAUTHORIZED;
                break;
            case 403:
                code = ErrorCode.FORBIDDEN;
                break;
            case 404:
                code = ErrorCode.NOT_FOUND;
                break;
            case 408:
                code = ErrorCode.REQUEST_TIMEOUT;
                break;
            case 409:
                code = ErrorCode.CONFLICT;
                break;
            case 429:
                code = ErrorCode.RATE_LIMITED;
                break;
            case 500:
                code = ErrorCode.INTERNAL_SERVER_ERROR;
                break;
            case 502:
                code = ErrorCode.BAD_GATEWAY;
                break;
            case 503:
                code = ErrorCode.SERVICE_UNAVAILABLE;
                break;
            case 504:
                code = ErrorCode.GATEWAY_TIMEOUT;
                break;
            default:
                code = statusCode >= 500 ? ErrorCode.INTERNAL_SERVER_ERROR : ErrorCode.UNKNOWN_ERROR;
        }
        return new SdkError(code, message, { statusCode });
    }
    static fromError(error, statusCode) {
        if (error instanceof SdkError) {
            return error;
        }
        const errorMessage = error.message.toLowerCase();
        const errorCode = error.code?.toLowerCase() || '';
        let code;
        const isConnectTimeout = errorMessage.includes('connect') ||
            errorCode.includes('conn') ||
            errorCode.includes('etimedout');
        const isTimeout = errorMessage.includes('timeout') ||
            errorMessage.includes('timed out') ||
            errorCode.includes('timeout') ||
            errorCode.includes('timedout');
        if (isTimeout) {
            code = isConnectTimeout ? ErrorCode.CONNECTION_TIMEOUT : ErrorCode.REQUEST_TIMEOUT;
        }
        else if (errorCode.includes('econnrefused') || errorCode.includes('enetunreach') ||
            errorCode.includes('econnreset') || errorMessage.includes('network')) {
            code = ErrorCode.NETWORK_ERROR;
        }
        else if (errorMessage.includes('econnrefused') || errorMessage.includes('enetunreach') ||
            errorMessage.includes('econnreset')) {
            code = ErrorCode.NETWORK_ERROR;
        }
        else if (errorMessage.includes('socket hang up')) {
            code = ErrorCode.NETWORK_ERROR;
        }
        else if (errorMessage.includes('configuration') || errorMessage.includes('config')) {
            code = ErrorCode.CONFIG_ERROR;
        }
        else {
            code = ErrorCode.UNKNOWN_ERROR;
        }
        return new SdkError(code, error.message, { statusCode, cause: error });
    }
}
exports.SdkError = SdkError;
