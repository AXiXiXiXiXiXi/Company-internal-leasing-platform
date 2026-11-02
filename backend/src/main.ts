import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';
import { ConfiguredIoAdapter } from './config/configured-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const allowedOrigins = (configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  });
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, allowedOrigins));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  }));
  app.useGlobalFilters(new DatabaseExceptionFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('固定资产借还系统 API')
    .setDescription(
      '资产台账、借用审批、实际交接、归还、历史和站内通知接口。'
      + '先调用 POST /api/auth/login，复制 accessToken，再点击右上角 Authorize 填入令牌。',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
    {
      swaggerOptions: {
        persistAuthorization: true,
      },
    },
  );

  const port = Number(configService.get('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  console.error('后端启动失败', error);
  process.exitCode = 1;
});
