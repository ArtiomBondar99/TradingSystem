import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { WalletResponseDto } from './dto/wallet-response.dto.js';
import { WalletsService } from './wallets.service.js';

// Singular "wallet": every user has exactly one, identified by the JWT
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  getMyWallet(
    @CurrentUser('userId') userId: string,
  ): Promise<WalletResponseDto> {
    return this.walletsService.getMyWallet(userId);
  }
}
