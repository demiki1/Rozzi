import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

// Matches the response shape mandated in spec §49:
// { success: false, error: { code, message } }
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? (exception as HttpException).getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? (exception as HttpException).getResponse() : null;

    const message =
      isHttp && typeof body === 'object' && body !== null && 'message' in body
        ? (body as any).message
        : isHttp
          ? (exception as HttpException).message
          : 'An unexpected error occurred.';

    const code = isHttp ? HttpStatus[status] ?? 'ERROR' : 'INTERNAL_ERROR';

    if (!isHttp) {
      // Full detail goes to server logs only — never to the client.
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      success: false,
      error: { code, message },
    });
  }
}
