import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppConfigService } from './config/app.config.service';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { ServerConfigKey } from './config/environment.enum';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-frontend-domain.com'] 
      : true,
    credentials: true,
  });

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
  const mongoUri = config.database.uri;
  
  await app.listen(port);
  
  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📊 Environment: ${config.server.nodeEnv}`);
  logger.log(`🗄️  MongoDB: ${mongoUri ? 'connected' : 'not configured'}`);
}
bootstrap();
