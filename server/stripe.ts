import { pointsService } from './points.js';

export interface PointsPackage {
  id: string;
  name: string;
  points: number;
  priceEur: number;
  priceFormatted: string;
  bonus?: string;
  popular?: boolean;
}

export const POINTS_PACKAGES: PointsPackage[] = [
  {
    id: 'pack_100',
    name: 'Starter Creator',
    points: 100,
    priceEur: 10,
    priceFormatted: '€10.00',
    bonus: 'Up to 22 Low or 10 High optimizations',
  },
  {
    id: 'pack_500',
    name: 'Growth Studio',
    points: 500,
    priceEur: 50,
    priceFormatted: '€50.00',
    popular: true,
    bonus: 'Up to 111 Low or 50 High optimizations',
  },
  {
    id: 'pack_1000',
    name: 'Agency Scale',
    points: 1000,
    priceEur: 100,
    priceFormatted: '€100.00',
    bonus: 'Up to 222 Low or 100 High optimizations',
  },
];

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim();

export const stripeService = {
  isConfigured(): boolean {
    return !!STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.includes('YOUR_');
  },

  getStatus() {
    return {
      configured: this.isConfigured(),
      hasWebhook: !!STRIPE_WEBHOOK_SECRET,
      packages: POINTS_PACKAGES,
      instructions: !this.isConfigured()
        ? 'To enable live Stripe checkouts, configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in your environment or Secrets panel.'
        : 'Stripe is active in live/test mode.',
    };
  },

  getPackage(packId: string): PointsPackage | undefined {
    return POINTS_PACKAGES.find((p) => p.id === packId);
  },

  // Simulates a test transaction safely when in sandbox test mode
  simulateTestCheckout(userId: string, packId: string) {
    const pkg = this.getPackage(packId);
    if (!pkg) throw new Error('Invalid points package selected');

    const receiptId = 'ch_test_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const result = pointsService.grantPurchasedPoints(userId, pkg.points, pkg.priceEur, receiptId);

    return {
      success: true,
      mode: 'test_sandbox',
      package: pkg,
      receiptId,
      newBalance: result.newBalance,
      transaction: result.transaction,
    };
  },
};
