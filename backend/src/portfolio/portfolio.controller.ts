import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PortfolioResponseDto } from './dto/portfolio-response.dto.js';
import { PortfolioService } from './portfolio.service.js';

// Singular, like /wallet: every user has exactly one portfolio
@ApiTags('portfolio')
@ApiBearerAuth()
@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  getMyPortfolio(
    @CurrentUser('userId') userId: string,
  ): Promise<PortfolioResponseDto> {
    return this.portfolioService.getMyPortfolio(userId);
  }
}
