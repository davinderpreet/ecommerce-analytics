import cron from 'node-cron';
import { syncShopifyOrders } from '../integrations/shopify';

class SchedulerService {
  private isRunning = false;
  private syncJob: cron.ScheduledTask | null = null;
  private historicalSyncInProgress = false;

  /**
   * Start the 3-minute sync job for today's data only
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    // Run every 3 minutes - sync only today's data
    this.syncJob = cron.schedule('*/3 * * * *', async () => {
      try {
        console.log('🔄 Starting 3-minute sync for today\'s data...');
        const startTime = Date.now();
        
        // Sync only today's data (1 day)
        await syncShopifyOrders(1);
        
        const duration = Date.now() - startTime;
        console.log(`✅ 3-minute sync completed in ${duration}ms`);
      } catch (error) {
        console.error('❌ 3-minute sync failed:', error);
      }
    });

    this.isRunning = true;
    console.log('🚀 Scheduler started - syncing today\'s data every 3 minutes');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.syncJob) {
      this.syncJob.stop();
      this.syncJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Scheduler stopped');
  }

  /**
   * One-time historical data sync for last 700 days
   * This is a heavy operation and should be run manually
   */
  async syncHistoricalData(): Promise<{ success: boolean; message: string; stats?: any }> {
    if (this.historicalSyncInProgress) {
      return {
        success: false,
        message: 'Historical sync already in progress'
      };
    }

    try {
      this.historicalSyncInProgress = true;
      console.log('🏗️ Starting historical data sync for last 700 days...');
      
      const startTime = Date.now();
      
      // Sync in chunks to avoid API rate limits and timeouts
      const chunkSize = 30; // 30 days per chunk
      const totalDays = 700;
      const chunks = Math.ceil(totalDays / chunkSize);
      
      let totalOrders = 0;
      let totalErrors = 0;

      for (let i = 0; i < chunks; i++) {
        const daysToSync = Math.min(chunkSize, totalDays - (i * chunkSize));
        const startDay = i * chunkSize;
        
        console.log(`📦 Syncing chunk ${i + 1}/${chunks} - Days ${startDay} to ${startDay + daysToSync}`);
        
        try {
          // Create a custom sync function for specific date ranges
          await this.syncDateRange(startDay, startDay + daysToSync);
          
          // Add delay between chunks to respect API limits
          if (i < chunks - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          }
        } catch (chunkError) {
          console.error(`❌ Error in chunk ${i + 1}:`, chunkError);
          totalErrors++;
        }
      }

      const duration = Date.now() - startTime;
      const stats = {
        totalChunks: chunks,
        totalDays: totalDays,
        duration: duration,
        errors: totalErrors
      };

      console.log(`✅ Historical sync completed in ${duration}ms`);
      console.log(`📊 Stats:`, stats);

      return {
        success: true,
        message: `Historical sync completed successfully`,
        stats
      };

    } catch (error) {
      console.error('❌ Historical sync failed:', error);
      return {
        success: false,
        message: `Historical sync failed: ${error.message}`
      };
    } finally {
      this.historicalSyncInProgress = false;
    }
  }

  /**
   * Sync specific date range (helper for historical sync)
   */
  private async syncDateRange(startDaysAgo: number, endDaysAgo: number) {
    const { syncShopifyOrdersDateRange } = await import('../integrations/shopify');
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - startDaysAgo);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - endDaysAgo);

    await syncShopifyOrdersDateRange(startDate, endDate);
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      historicalSyncInProgress: this.historicalSyncInProgress,
      nextRun: this.syncJob ? 'Every 3 minutes' : 'Not scheduled'
    };
  }

  /**
   * Force run today's sync manually
   */
  async runTodaySync(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 Manual sync for today\'s data...');
      const startTime = Date.now();
      
      await syncShopifyOrders(1);
      
      const duration = Date.now() - startTime;
      return {
        success: true,
        message: `Today's sync completed in ${duration}ms`
      };
    } catch (error) {
      console.error('❌ Manual today sync failed:', error);
      return {
        success: false,
        message: `Manual sync failed: ${error.message}`
      };
    }
  }
}

// Export singleton instance
export const scheduler = new SchedulerService();
