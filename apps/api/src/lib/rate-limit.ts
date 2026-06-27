interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  check(key: string): RateLimitResult {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      return {
        allowed: true,
        remaining: this.limit,
        retryAfterSeconds: 0
      };
    }

    return {
      allowed: current.count < this.limit,
      remaining: Math.max(0, this.limit - current.count),
      retryAfterSeconds: Math.max(0, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  consume(key: string): RateLimitResult {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + this.windowMs
      });
      return {
        allowed: true,
        remaining: Math.max(0, this.limit - 1),
        retryAfterSeconds: 0
      };
    }

    current.count += 1;
    this.buckets.set(key, current);

    return {
      allowed: current.count <= this.limit,
      remaining: Math.max(0, this.limit - current.count),
      retryAfterSeconds: Math.max(0, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
