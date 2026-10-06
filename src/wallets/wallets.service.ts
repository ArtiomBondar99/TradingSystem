import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletResponseDto } from './dto/wallet-response.dto.js';
import { WalletsRepository } from './wallets.repository.js';

@Injectable()
export class WalletsService {
  constructor(private readonly walletsRepository: WalletsRepository) {}

  async getMyWallet(userId: string): Promise<WalletResponseDto> {
    const wallet = await this.walletsRepository.findByUserId(userId);

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return WalletResponseDto.fromEntity(wallet);
  }
}
