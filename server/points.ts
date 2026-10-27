import { dbService, OptimizationLevel, PointTransaction } from './db.js';

export const POINT_COSTS: Record<OptimizationLevel, number> = {
  low: 4.5,
  medium: 8.5,
  high: 10.0,
};

export const WEEKLY_FREE_POINTS = 30.0;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const pointsService = {
  getPointCost(level: OptimizationLevel): number {
    return POINT_COSTS[level] || 4.5;
  },

  getPointsStatus(userId: string) {
    const user = dbService.getUserById(userId);
    if (!user) throw new Error('User not found');

    const now = Date.now();
    const lastClaimed = user.lastFreePointsClaimedAt || 0;
    const elapsed = now - lastClaimed;
    const canClaim = elapsed >= SEVEN_DAYS_MS;
    const remainingMs = canClaim ? 0 : SEVEN_DAYS_MS - elapsed;

    return {
      balance: Math.round(user.pointsBalance * 10) / 10,
      lastClaimedAt: lastClaimed,
      canClaimWeekly: canClaim,
      nextClaimAt: lastClaimed + SEVEN_DAYS_MS,
      secondsUntilNextClaim: Math.ceil(remainingMs / 1000),
      pointCosts: POINT_COSTS,
    };
  },

  claimWeeklyPoints(userId: string): { newBalance: number; transaction: PointTransaction } {
    const user = dbService.getUserById(userId);
    if (!user) throw new Error('User not found');

    const now = Date.now();
    const elapsed = now - (user.lastFreePointsClaimedAt || 0);

    if (elapsed < SEVEN_DAYS_MS) {
      const waitDays = Math.ceil((SEVEN_DAYS_MS - elapsed) / (1000 * 60 * 60 * 24));
      throw new Error(`Weekly reward not ready yet. Please wait ${waitDays} more day(s).`);
    }

    const newBalance = Math.round((user.pointsBalance + WEEKLY_FREE_POINTS) * 10) / 10;
    dbService.updateUserPoints(userId, newBalance, now);

    const tx = dbService.createTransaction({
      userId,
      type: 'weekly_grant',
      amount: WEEKLY_FREE_POINTS,
      balanceAfter: newBalance,
      description: `Weekly creator grant: +${WEEKLY_FREE_POINTS.toFixed(1)} free optimization points`,
    });

    return { newBalance, transaction: tx };
  },

  reservePointsForJob(userId: string, jobId: string, level: OptimizationLevel): { cost: number; newBalance: number } {
    const user = dbService.getUserById(userId);
    if (!user) throw new Error('User not found');

    const cost = POINT_COSTS[level];
    if (user.pointsBalance < cost) {
      throw new Error(
        `Insufficient points: ${level.toUpperCase()} optimization costs ${cost.toFixed(1)} points, but your current balance is ${user.pointsBalance.toFixed(1)} points. Claim your weekly points or acquire more in the Shop.`
      );
    }

    const newBalance = Math.round((user.pointsBalance - cost) * 10) / 10;
    dbService.updateUserPoints(userId, newBalance);

    dbService.createTransaction({
      userId,
      type: 'reservation',
      amount: -cost,
      balanceAfter: newBalance,
      referenceJobId: jobId,
      description: `Hold for ${level.toUpperCase()} optimization (-${cost.toFixed(1)} pts)`,
    });

    return { cost, newBalance };
  },

  finalizeDeduction(userId: string, jobId: string, level: OptimizationLevel): void {
    const user = dbService.getUserById(userId);
    if (!user) return;
    const cost = POINT_COSTS[level];

    dbService.createTransaction({
      userId,
      type: 'deduction',
      amount: 0, // already deducted at reservation, this records successful finalization
      balanceAfter: user.pointsBalance,
      referenceJobId: jobId,
      description: `Finalized: ${level.toUpperCase()} video optimization completed successfully (-${cost.toFixed(1)} pts)`,
    });
  },

  refundPointsForJob(userId: string, jobId: string, level: OptimizationLevel, reason: string): number {
    const user = dbService.getUserById(userId);
    if (!user) throw new Error('User not found');

    const cost = POINT_COSTS[level];
    const newBalance = Math.round((user.pointsBalance + cost) * 10) / 10;
    dbService.updateUserPoints(userId, newBalance);

    dbService.createTransaction({
      userId,
      type: 'refund',
      amount: cost,
      balanceAfter: newBalance,
      referenceJobId: jobId,
      description: `Refund for job ${jobId} (${reason}): +${cost.toFixed(1)} pts restored`,
    });

    return newBalance;
  },

  grantPurchasedPoints(userId: string, points: number, priceEur: number, receiptId?: string): { newBalance: number; transaction: PointTransaction } {
    const user = dbService.getUserById(userId);
    if (!user) throw new Error('User not found');

    const newBalance = Math.round((user.pointsBalance + points) * 10) / 10;
    dbService.updateUserPoints(userId, newBalance);

    const tx = dbService.createTransaction({
      userId,
      type: 'purchase',
      amount: points,
      balanceAfter: newBalance,
      description: `Purchased +${points} points pack (€${priceEur.toFixed(2)}${receiptId ? ` · Ref: ${receiptId}` : ''})`,
    });

    return { newBalance, transaction: tx };
  },
};
