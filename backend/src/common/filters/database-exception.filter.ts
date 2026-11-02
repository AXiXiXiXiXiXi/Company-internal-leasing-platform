import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface MysqlDriverError {
  code?: string;
}

@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const driverError = exception.driverError as MysqlDriverError;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '数据库操作失败';
    if (driverError?.code === 'ER_DUP_ENTRY') {
      statusCode = HttpStatus.CONFLICT;
      message = '数据已存在或与当前业务状态冲突';
    } else if (
      driverError?.code === 'ER_NO_REFERENCED_ROW_2'
      || driverError?.code === 'ER_ROW_IS_REFERENCED_2'
    ) {
      statusCode = HttpStatus.CONFLICT;
      message = '数据关联关系不允许此操作';
    } else {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(statusCode).json({
      statusCode,
      error: statusCode === HttpStatus.CONFLICT ? 'Conflict' : 'Internal Server Error',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
