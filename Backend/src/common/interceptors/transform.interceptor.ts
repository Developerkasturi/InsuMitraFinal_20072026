// ─────────────────────────────────────────────────────────────────────────────
// Transform Interceptor — wraps every successful response in a standard envelope
// { success, data, message, meta }
// ─────────────────────────────────────────────────────────────────────────────
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message: string;
  meta?:   Record<string, any>;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        // If handler returns { data, message, meta } use them directly,
        // otherwise wrap raw return value
        if (result && typeof result === 'object' && 'data' in result) {
          const r = result as any;
          return {
            success: true,
            data:    r.data,
            message: r.message ?? 'OK',
            meta:    r.meta,
          };
        }
        return { success: true, data: result, message: 'OK' };
      }),
    );
  }
}
