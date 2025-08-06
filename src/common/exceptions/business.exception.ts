import { HttpException, HttpStatus } from '@nestjs/common';
import { ResponseCode, ResponseMessage } from '../../config/environment.enum';

export const throwValidationError = (message: string, description?: string) => {
  throw new HttpException(
    { 
      message, 
      code: ResponseCode.VALIDATION_ERROR, 
      description: description || ResponseMessage.VALIDATION_FAILED 
    },
    HttpStatus.BAD_REQUEST,
  );
};

export const throwAuthenticationError = (message: string, description?: string) => {
  throw new HttpException(
    { 
      message, 
      code: ResponseCode.AUTHENTICATION_ERROR, 
      description: description || ResponseMessage.AUTHENTICATION_FAILED 
    },
    HttpStatus.UNAUTHORIZED,
  );
};

export const throwAuthorizationError = (message: string, description?: string) => {
  throw new HttpException(
    { 
      message, 
      code: ResponseCode.AUTHORIZATION_ERROR, 
      description: description || ResponseMessage.AUTHORIZATION_FAILED 
    },
    HttpStatus.FORBIDDEN,
  );
};

export const throwBusinessError = (message: string, description?: string) => {
  throw new HttpException(
    { 
      message, 
      code: ResponseCode.BUSINESS_ERROR, 
      description: description || ResponseMessage.BUSINESS_ERROR 
    },
    HttpStatus.BAD_REQUEST,
  );
};

// Legacy classes for backward compatibility
export class BusinessException extends HttpException {
  constructor(message: string, code: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      { message, code, description: message },
      status,
    );
  }
}

export class ValidationException extends BusinessException {
  constructor(message: string) {
    super(message, ResponseCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
  }
}

export class AuthenticationException extends BusinessException {
  constructor(message: string) {
    super(message, ResponseCode.AUTHENTICATION_ERROR, HttpStatus.UNAUTHORIZED);
  }
}

export class AuthorizationException extends BusinessException {
  constructor(message: string) {
    super(message, ResponseCode.AUTHORIZATION_ERROR, HttpStatus.FORBIDDEN);
  }
}

export class BusinessLogicException extends BusinessException {
  constructor(message: string) {
    super(message, ResponseCode.BUSINESS_ERROR, HttpStatus.BAD_REQUEST);
  }
} 