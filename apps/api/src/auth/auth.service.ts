import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { malls, refreshTokens, roleAssignments, type Transaction, users } from '@mall-pms/db';
import type { AccessTokenClaims, AuthTokens, MeResponse, Role } from '@mall-pms/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config';
import { DatabaseService } from '../database/database.module';
import type { AuthUser } from './auth.types';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  /** Verified against when the email is unknown, so both paths take similar time. */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.dummyHash = hash(randomBytes(16).toString('hex'));
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const [user] = await this.database.db
      .select({
        id: users.id,
        orgId: users.orgId,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    const valid = await verify(user?.passwordHash ?? (await this.dummyHash), password);
    if (!user || !valid || !user.isActive)
      throw new UnauthorizedException('Invalid email or password');

    await this.database.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    return this.database.db.transaction((tx) => this.issueTokens(tx, user, randomUUID()));
  }

  /**
   * Rotates a refresh token. Presenting a token that was already rotated or
   * revoked means it may have been stolen, so the whole family is revoked.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    // The transaction returns null instead of throwing, so that a family
    // revocation is committed rather than rolled back with the error.
    const tokens = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, sha256(refreshToken)))
        .for('update');
      if (!row) return null;

      if (row.revokedAt) {
        await this.revokeFamily(tx, row.familyId);
        return null;
      }
      if (row.expiresAt <= new Date()) return null;

      const [user] = await tx
        .select({ id: users.id, orgId: users.orgId, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, row.userId));
      if (!user?.isActive) return null;

      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, row.id));
      return this.issueTokens(tx, user, row.familyId);
    });
    if (!tokens) throw new UnauthorizedException();
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ familyId: refreshTokens.familyId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, sha256(refreshToken)));
      if (row) await this.revokeFamily(tx, row.familyId);
    });
  }

  async loadActiveUser(userId: string): Promise<AuthUser | null> {
    const [user] = await this.database.db
      .select({
        id: users.id,
        orgId: users.orgId,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.isActive) return null;

    const assignments = await this.database.db
      .select({ role: roleAssignments.role, mallId: roleAssignments.mallId })
      .from(roleAssignments)
      .where(eq(roleAssignments.userId, userId));

    return {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      fullName: user.fullName,
      assignments: assignments.map((a) => ({ role: a.role as Role, mallId: a.mallId })),
    };
  }

  async me(user: AuthUser): Promise<MeResponse> {
    const roles = await this.database.tenant(user, (tx) =>
      tx
        .select({
          role: roleAssignments.role,
          mallId: roleAssignments.mallId,
          mallCode: malls.code,
        })
        .from(roleAssignments)
        .leftJoin(malls, eq(malls.id, roleAssignments.mallId))
        .where(eq(roleAssignments.userId, user.id)),
    );
    return {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      fullName: user.fullName,
      roles: roles.map((r) => ({ role: r.role as Role, mallId: r.mallId, mallCode: r.mallCode })),
    };
  }

  private async issueTokens(
    tx: Transaction,
    user: { id: string; orgId: string },
    familyId: string,
  ): Promise<AuthTokens> {
    const claims: AccessTokenClaims = { sub: user.id, org: user.orgId };
    const accessToken = await this.jwt.signAsync(claims, {
      expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshToken = randomBytes(32).toString('base64url');
    await tx.insert(refreshTokens).values({
      userId: user.id,
      familyId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    });

    return { accessToken, expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS, refreshToken };
  }

  private async revokeFamily(tx: Transaction, familyId: string) {
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }
}
