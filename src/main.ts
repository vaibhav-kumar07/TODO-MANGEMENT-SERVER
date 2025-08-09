import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppConfigService } from './config/app.config.service';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');
  app.enableCors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
    });

  // Attach the Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));
  // // Security middleware
  app.use(helmet());
  app.use(compression());


  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  const config = configService.loadConfig();
  const port = config.server.port;
  const wsPort = process.env.WS_PORT || 3002;
  const mongoUri = config.database.uri;

  await app.listen(port);

  logger.log(` HTTP Server running on http://localhost:${port}`);
  logger.log(`WebSocket Server running on http://localhost:${wsPort}/dashboard`);
  logger.log(`Environment: ${config.server.nodeEnv}`);
  logger.log(`  MongoDB: ${mongoUri ? 'connected' : 'not configured'}`);
  logger.log(` Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
}
bootstrap();
