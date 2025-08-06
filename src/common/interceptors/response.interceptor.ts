import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseCode, ResponseMessage } from '../../config/environment.enum';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    description?: string;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map(data => {
        if (data && data.success === false) {
          // Error response
          return {
            success: false,
            message: data.message || 'Operation failed',
            error: {
              code: data.code || ResponseCode.BUSINESS_ERROR,
              description: data.description,
            },
          };
        }

        // Success response
        return {
          success: true,
          message: data?.message || ResponseMessage.SUCCESS,
          data: data?.data || data,
        };
      }),
    );
  }
} 