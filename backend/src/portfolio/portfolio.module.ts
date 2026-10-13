import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioRepository } from './portfolio.repository.js';
import { PortfolioService } from './portfolio.service.js';

@Module({
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioRepository],
})
export class PortfolioModule {}
