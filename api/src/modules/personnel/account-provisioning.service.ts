import type { ClerkClient, User } from '@clerk/backend';
import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, eq, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import {
  farms,
  personnelAccountProvisions,
  type PersonnelProvisionPayload,
} from '../../db/schema';
import { AuthService } from '../auth/accounts/auth.service';
import { CLERK_CLIENT } from '../auth/clerk/clerk-client.provider';
import { throwClerkError } from '../auth/clerk/clerk-errors';
import {
  AddExistingAccountDto,
  CreatePersonnelAccountDto,
} from './dto/personnel.dto';
import { PersonnelService } from './personnel.service';

@Injectable()
export class AccountProvisioningService {
  constructor(
    private readonly database: DatabaseService,
    private readonly personnel: PersonnelService,
    private readonly auth: AuthService,
    @Inject(CLERK_CLIENT) private readonly clerk: ClerkClient,
  ) {}

  async create(
    farmId: string,
    clerkUserId: string,
    input: CreatePersonnelAccountDto,
  ) {
    const actor = await this.personnel.assertManager(farmId, clerkUserId);
    await this.auth.limitCredentialAction(actor.userId, 'CREATE_ACCOUNT');
    const payload = this.payload(input);
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    let [provision] = await this.database.db
      .select()
      .from(personnelAccountProvisions)
      .where(eq(personnelAccountProvisions.id, input.requestId));
    if (!provision) {
      await this.personnel.validateCreation(farmId, clerkUserId, input);
      await this.database.db
        .insert(personnelAccountProvisions)
        .values({
          id: input.requestId,
          farmId,
          actorUserId: actor.userId,
          email: payload.email,
          payloadHash,
          payload,
        })
        .onConflictDoNothing();
      [provision] = await this.database.db
        .select()
        .from(personnelAccountProvisions)
        .where(eq(personnelAccountProvisions.id, input.requestId));
    }
    if (
      provision.actorUserId !== actor.userId ||
      provision.farmId !== farmId ||
      provision.payloadHash !== payloadHash
    )
      throw new ConflictException({
        code: 'REQUEST_ID_CONFLICT',
        message: 'This request ID belongs to another account creation payload.',
      });
    if (provision.status === 'COMPLETED' && provision.memberId)
      return {
        httpStatus: 200,
        data: await this.personnel.detail(
          provision.memberId,
          farmId,
          clerkUserId,
        ),
      };
    const externalId = `personnel:${provision.id}`;
    try {
      // Serialize identity creation only; each stage commits its recovery state before the next.
      const identity = await this.database.db.transaction(async (tx) => {
        const lock = await tx.execute<{ locked: boolean }>(
          sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${externalId}, 0)) AS locked`,
        );
        if (!lock.rows[0].locked) return null;
        const [current] = await tx
          .select()
          .from(personnelAccountProvisions)
          .where(eq(personnelAccountProvisions.id, provision.id))
          .for('update');
        let user: User;
        try {
          if (current.clerkUserId)
            user = await this.clerk.users.getUser(current.clerkUserId);
          else {
            const recovered = await this.clerk.users.getUserList({
              externalId: [externalId],
              limit: 2,
            });
            if (recovered.data.length > 1)
              throw new ConflictException({
                code: 'IDENTITY_CONFLICT',
                message: 'The provision requires operator review.',
              });
            user =
              recovered.data[0] ??
              (await this.clerk.users.createUser({
                externalId,
                emailAddress: [payload.email],
                emailAddressIdentificationStatus: ['reserved'],
                firstName: payload.fullName,
                password: input.initialPassword,
                banned: true,
              }));
          }
        } catch (error) {
          if (error instanceof HttpException) throw error;
          throwClerkError(error);
        }
        this.verifyIdentity(user, externalId, payload.email);
        if (!user.banned && !current.memberId)
          throw new ConflictException({
            code: 'IDENTITY_CONFLICT',
            message:
              'An incomplete provision must remain blocked from sign-in.',
          });
        if (!current.clerkUserId)
          await tx
            .update(personnelAccountProvisions)
            .set({
              clerkUserId: user.id,
              status: 'IDENTITY_CREATED',
              errorCode: null,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(personnelAccountProvisions.id, current.id));
        return user;
      });
      if (!identity)
        return {
          httpStatus: 202,
          requestId: input.requestId,
          status: 'PENDING' as const,
        };
      const member = await this.personnel.createMembership(
        farmId,
        clerkUserId,
        payload,
        this.identity(identity, payload.email),
        provision.id,
      );
      await this.database.db.transaction(async (tx) => {
        await tx
          .select({ id: farms.id })
          .from(farms)
          .where(eq(farms.id, farmId))
          .for('update');
        await this.personnel.assertManager(farmId, clerkUserId, tx);
        const [current] = await tx
          .select()
          .from(personnelAccountProvisions)
          .where(eq(personnelAccountProvisions.id, provision.id))
          .for('update');
        if (current.status === 'COMPLETED') return;
        try {
          const user = await this.clerk.users.getUser(identity.id);
          this.verifyIdentity(user, externalId, payload.email);
          if (user.banned) await this.clerk.users.unbanUser(user.id);
        } catch (error) {
          if (error instanceof HttpException) throw error;
          throwClerkError(error);
        }
        await tx
          .update(personnelAccountProvisions)
          .set({
            status: 'COMPLETED',
            errorCode: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(personnelAccountProvisions.id, current.id));
      });
      return { httpStatus: 201, data: member };
    } catch (error) {
      const safe =
        error instanceof HttpException
          ? error
          : new ServiceUnavailableException({
              code: 'ACCOUNT_PROVISION_RETRY',
              message:
                'The account is not ready for sign-in. Retry with the same request ID.',
            });
      const response = safe.getResponse();
      const code =
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
          ? response.code
          : 'ACCOUNT_PROVISION_RETRY';
      await this.database.db
        .update(personnelAccountProvisions)
        .set({
          errorCode: code,
          ...([400, 409].includes(safe.getStatus())
            ? { status: 'FAILED' as const }
            : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(personnelAccountProvisions.id, provision.id),
            ne(personnelAccountProvisions.status, 'COMPLETED'),
          ),
        )
        // Recovery milestones are committed; annotation failure must not replace the safe error.
        .catch(() => undefined);
      throw safe;
    }
  }

  private verifyIdentity(user: User, externalId: string, email: string) {
    if (
      user.externalId !== externalId ||
      !user.emailAddresses.some(
        (address) => address.emailAddress.toLowerCase() === email,
      )
    )
      throw new ConflictException({
        code: 'IDENTITY_CONFLICT',
        message:
          'The provision identity cannot be verified. Contact an operator.',
      });
  }

  async addExisting(
    farmId: string,
    clerkUserId: string,
    input: AddExistingAccountDto,
  ) {
    const actor = await this.personnel.validateCreation(
      farmId,
      clerkUserId,
      input,
    );
    await this.auth.limitCredentialAction(actor.userId, 'ADD_ACCOUNT');
    let matches: User[];
    try {
      matches = (
        await this.clerk.users.getUserList({
          emailAddress: [input.email],
          limit: 2,
        })
      ).data;
    } catch (error) {
      throwClerkError(error);
    }
    const exact = matches.filter((user) =>
      user.emailAddresses.some(
        (email) => email.emailAddress.toLowerCase() === input.email,
      ),
    );
    if (exact.length !== 1)
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'No account matches this exact email.',
      });
    if (exact[0].banned || exact[0].locked)
      throw new ConflictException({
        code: 'ACCOUNT_INACTIVE',
        message: 'The account cannot currently sign in.',
      });
    return this.personnel.createMembership(
      farmId,
      clerkUserId,
      input,
      this.identity(exact[0], input.email),
    );
  }

  private identity(user: User, email: string) {
    return {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? email,
      fullName:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      avatarUrl: user.imageUrl || null,
    };
  }

  private payload(input: CreatePersonnelAccountDto): PersonnelProvisionPayload {
    return {
      fullName: input.fullName,
      email: input.email,
      roleCodes: [...input.roleCodes].sort(),
      warehouseIds: [...input.warehouseIds].sort(),
      employeeCode: input.employeeCode ?? null,
      jobTitle: input.jobTitle ?? null,
      phone: input.phone ?? null,
      note: input.note ?? null,
    };
  }
}
