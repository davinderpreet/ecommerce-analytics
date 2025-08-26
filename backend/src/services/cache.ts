import cache from 'memory-cache';

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
}

class CacheService {
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    return cache.get(key) || null;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || this.defaultTTL;
    cache.put(key, value, ttl);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    cache.del(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: cache.size(),
      keys: cache.keys(),
      memsize: cache.memsize(),
    };
  }

  /**
   * Generate cache key for analytics endpoints
   */
  generateAnalyticsKey(endpoint: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `analytics:${endpoint}:${sortedParams}`;
  }

  /**
   * Cache wrapper for analytics functions
   */
  async withCache<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      console.log(`📦 Cache HIT for key: ${key}`);
      return cached;
    }

    console.log(`🔍 Cache MISS for key: ${key}`);
    
    // Fetch fresh data
    const result = await fetchFunction();
    
    // Store in cache
    this.set(key, result, options);
    
    return result;
  }
}

// Export singleton instance
export const cacheService = new CacheService();
