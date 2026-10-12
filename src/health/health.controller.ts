import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipRateLimit } from '../common/decorators/rate-limit.decorator.js';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './health.service.js';

@ApiTags('health')
@Controller('health')
// Docker and load balancers poll this all the time: never rate-limit it
@SkipRateLimit()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
