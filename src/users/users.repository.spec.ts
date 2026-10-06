import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error.js';
import { UsersRepository } from './users.repository.js';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  const prisma = { user: { create: vi.fn(), findUnique: vi.fn() } };

  const input = {
    email: 'trader@example.com',
    passwordHash: 'x',
    initialBalance: '100000.00',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(UsersRepository);
  });

  it('creates the user and the wallet in a single nested write', async () => {
    prisma.user.create.mockResolvedValue({ id: 'user-1' });

    await repository.createWithWallet(input);

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'trader@example.com',
        passwordHash: 'x',
        wallet: { create: { balance: '100000.00' } },
      },
    });
  });

  it('translates a unique constraint violation into EmailAlreadyExistsError', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      }),
    );

    await expect(repository.createWithWallet(input)).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it('rethrows any other database error unchanged', async () => {
    const dbDown = new Error('connection refused');
    prisma.user.create.mockRejectedValue(dbDown);

    await expect(repository.createWithWallet(input)).rejects.toBe(dbDown);
  });
});
