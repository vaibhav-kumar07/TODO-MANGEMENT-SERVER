import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ResponseCode, ResponseMessage } from '../../config/environment.enum';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    let errorCode = ResponseCode.BUSINESS_ERROR;
    let errorMessage = ResponseMessage.BUSINESS_ERROR;
    let errorDescription = exceptionResponse?.description || exceptionResponse?.message;

    // Determine error type based on status code
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        errorCode = ResponseCode.VALIDATION_ERROR;
        errorMessage = ResponseMessage.VALIDATION_FAILED;
        break;
      case HttpStatus.UNAUTHORIZED:
        errorCode = ResponseCode.AUTHENTICATION_ERROR;
        errorMessage = ResponseMessage.AUTHENTICATION_FAILED;
        break;
      case HttpStatus.FORBIDDEN:
        errorCode = ResponseCode.AUTHORIZATION_ERROR;
        errorMessage = ResponseMessage.AUTHORIZATION_FAILED;
        break;
    }

    // Use custom error details if available
    if (exceptionResponse?.code) {
      errorCode = exceptionResponse.code;
    }
    if (exceptionResponse?.message) {
      errorMessage = exceptionResponse.message;
    }

    const errorResponse = {
      success: false,
      message: errorMessage,
      error: {
        code: errorCode,
        description: errorDescription,
      },
    };

    response.status(status).json(errorResponse);
  }
} 