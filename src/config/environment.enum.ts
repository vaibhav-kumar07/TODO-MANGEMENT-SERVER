export enum JwtConfigKey {
  SECRET = 'JWT_SECRET',
  EXPIRES_IN = 'JWT_EXPIRES_IN',
  REFRESH_SECRET = 'JWT_REFRESH_SECRET',
  REFRESH_EXPIRES_IN = 'JWT_REFRESH_EXPIRES_IN',
  RESET_SECRET = 'JWT_RESET_SECRET',
}

export enum DatabaseConfigKey {
  URI = 'DATABASE_URI',
}

export enum EmailConfigKey {
  USER = 'EMAIL_USER',
  PASS = 'EMAIL_PASS',

}

export enum RedisConfigKey {
  HOST = 'REDIS_HOST',
  PORT = 'REDIS_PORT',
  PASSWORD = 'REDIS_PASSWORD',
  DB = 'REDIS_DB',
}

export enum ServerConfigKey {
  PORT = 'PORT',
  WS_PORT = 'WS_PORT',
  NODE_ENV = 'NODE_ENV',
  FRONTEND_URL = 'FRONTEND_URL',
}

export enum ResponseCode {
  SUCCESS = 'SUCCESS',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  BUSINESS_ERROR = 'BUSINESS_ERROR',
}

export enum ResponseMessage {
  SUCCESS = 'Operation completed successfully',
  VALIDATION_FAILED = 'Validation failed',
  AUTHENTICATION_FAILED = 'Authentication failed',
  AUTHORIZATION_FAILED = 'Access denied',
  BUSINESS_ERROR = 'Business logic error',
} 