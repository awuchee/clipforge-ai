import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Last-resort error handler: logs every 5xx (including unhandled non-HTTP
 * exceptions) with method/path/stack so they show up in process logs for
 * monitoring/alerting, without changing the response shape for normal
 * HttpExceptions (e.g. the `{message, code}` body used by PLAN_LIMIT_REACHED).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        this.logger.error(`${request.method} ${request.url} -> ${status}: ${exception.message}`, exception.stack);
      }
      response.status(status).json(exception.getResponse());
      return;
    }

    const error = exception as Error;
    this.logger.error(`${request.method} ${request.url} -> 500: ${error?.message}`, error?.stack);
    response.status(500).json({ statusCode: 500, message: error?.message ?? 'Internal server error' });
  }
}
