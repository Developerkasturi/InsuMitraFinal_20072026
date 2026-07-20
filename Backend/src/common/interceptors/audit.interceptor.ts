import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user, body, params } = req;

    return next.handle().pipe(
      tap(() => {
        // Only log modifying actions
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && user?.tenantId) {
          const entityType = this.extractEntityType(url);
          const entityId = params.id || body.id || 'N/A';
          const action = this.mapMethodToAction(method);

          // We execute the logging async without awaiting, so it doesn't slow down the response
          this.prisma.activityLog.create({
            data: {
              tenantId: user.tenantId,
              userId: user.userId || user.id,
              entityType,
              entityId,
              action,
              description: `${action} operation on ${entityType}`,
              metadata: { url, body: method !== 'DELETE' ? this.sanitizeBody(body) : null },
            },
          }).catch(err => {
            this.logger.error(`Failed to create activity log: ${err.message}`);
          });
        }
      }),
    );
  }

  private mapMethodToAction(method: string): string {
    switch (method) {
      case 'POST': return 'CREATE';
      case 'PUT':
      case 'PATCH': return 'UPDATE';
      case 'DELETE': return 'DELETE';
      default: return method;
    }
  }

  private extractEntityType(url: string): string {
    const parts = url.split('/');
    // e.g., /api/contacts/123 -> contacts
    const entityPlural = parts.find(p => ['contacts', 'policies', 'claims', 'leads', 'employees', 'tasks', 'agency-details', 'banners'].includes(p));
    
    switch (entityPlural) {
      case 'contacts': return 'Contact';
      case 'policies': return 'Policy';
      case 'claims': return 'Claim';
      case 'leads': return 'Lead';
      case 'employees': return 'Employee';
      case 'tasks': return 'Task';
      default: return 'System';
    }
  }

  private sanitizeBody(body: any) {
    if (!body) return {};
    const sanitized = { ...body };
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    return sanitized;
  }
}
