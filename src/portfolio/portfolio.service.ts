import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  PortfolioResponseDto,
  PositionResponseDto,
} from './dto/portfolio-response.dto.js';
import {
  PortfolioRepository,
  type PositionWithStock,
} from './portfolio.repository.js';

// One position's numbers, still as exact Decimals (formatted only at the end)
type Valuation = {
  position: PositionWithStock;
  marketValue: Prisma.Decimal;
  costBasis: Prisma.Decimal;
  unrealizedPnL: Prisma.Decimal;
};

@Injectable()
export class PortfolioService {
  constructor(private readonly portfolioRepository: PortfolioRepository) {}

  async getMyPortfolio(userId: string): Promise<PortfolioResponseDto> {
    const { wallet, positions } =
      await this.portfolioRepository.findByUserId(userId);

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const valuations = positions.map((position) => this.value(position));

    const positionsValue = this.sum(valuations.map((v) => v.marketValue));
    const unrealizedPnL = this.sum(valuations.map((v) => v.unrealizedPnL));

    return {
      cashBalance: wallet.cashBalance.toFixed(2),
      positionsValue: positionsValue.toFixed(2),
      totalValue: wallet.cashBalance.add(positionsValue).toFixed(2),
      unrealizedPnL: unrealizedPnL.toFixed(2),
      positions: valuations.map((v) => this.toPositionDto(v)),
    };
  }

  private value(position: PositionWithStock): Valuation {
    const marketValue = position.stock.currentPrice.mul(position.quantity);
    const costBasis = position.averagePrice.mul(position.quantity);

    return {
      position,
      marketValue,
      costBasis,
      unrealizedPnL: marketValue.sub(costBasis),
    };
  }

  private toPositionDto(valuation: Valuation): PositionResponseDto {
    const { position, marketValue, costBasis, unrealizedPnL } = valuation;

    return {
      symbol: position.stock.symbol,
      name: position.stock.name,
      quantity: position.quantity,
      averagePrice: position.averagePrice.toFixed(2),
      currentPrice: position.stock.currentPrice.toFixed(2),
      marketValue: marketValue.toFixed(2),
      unrealizedPnL: unrealizedPnL.toFixed(2),
      // costBasis is never 0: every buy price is > 0 (DB CHECK constraint)
      unrealizedPnLPercent: unrealizedPnL.div(costBasis).mul(100).toFixed(2),
    };
  }

  private sum(values: Prisma.Decimal[]): Prisma.Decimal {
    return values.reduce((total, v) => total.add(v), new Prisma.Decimal(0));
  }
}
