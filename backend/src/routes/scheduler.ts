import { Router } from 'express';
import { scheduler } from '../services/scheduler';
import { cacheService } from '../services/cache';

const router = Router();

/**
 * GET /api/v1/scheduler/status
 * Get scheduler status
 */
router.get('/status', (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/scheduler/start
 * Start the 3-minute sync scheduler
 */
router.post('/start', (req, res) => {
  try {
    scheduler.start();
    res.json({
      success: true,
      message: 'Scheduler started - syncing today\'s data every 3 minutes'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/scheduler/stop
 * Stop the scheduler
 */
router.post('/stop', (req, res) => {
  try {
    scheduler.stop();
    res.json({
      success: true,
      message: 'Scheduler stopped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/scheduler/sync-today
 * Manually trigger today's sync
 */
router.post('/sync-today', async (req, res) => {
  try {
    const result = await scheduler.runTodaySync();
    
    // Clear cache after sync
    cacheService.clear();
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/scheduler/sync-historical
 * Trigger historical data sync for last 700 days
 */
router.post('/sync-historical', async (req, res) => {
  try {
    // Start the historical sync (this will run in background)
    const result = await scheduler.syncHistoricalData();
    
    // Clear cache after sync
    cacheService.clear();
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/scheduler/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = cacheService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/scheduler/cache/clear
 * Clear all cache
 */
router.post('/cache/clear', (req, res) => {
  try {
    cacheService.clear();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
