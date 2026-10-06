import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error.js';
import { UsersRepository } from './users.repository.js';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  const prisma = { user: { create: vi.fn(), findUnique: vi.fn() } };

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

  it('translates a unique constraint violation into EmailAlreadyExistsError', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      }),
    );

    await expect(
      repository.create({ email: 'taken@example.com', passwordHash: 'x' }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('rethrows any other database error unchanged', async () => {
    const dbDown = new Error('connection refused');
    prisma.user.create.mockRejectedValue(dbDown);

    await expect(
      repository.create({ email: 'a@example.com', passwordHash: 'x' }),
    ).rejects.toBe(dbDown);
  });
});
