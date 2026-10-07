import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';

export interface HealthStatus {
  status: 'ok';
  database: 'up';
  environment: string;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<HealthStatus> {
    const environment = this.config.getOrThrow<string>('app.environment');

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // 503, not 200: Docker and load balancers only look at the status code
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        environment,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      database: 'up',
      environment,
      timestamp: new Date().toISOString(),
    };
  }
}
