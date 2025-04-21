// internal-extension.js - Example of custom extension implementation
import { LambdaHooks } from 'lambda-extension-hooks';

// Create a metrics collector extension
(async function startMetricsExtension() {
  const metrics = {
    invocations: 0,
    errors: 0,
    coldStarts: true,
    startTime: Date.now(),
    invocationTimes: []
  };

  const hooks = new LambdaHooks({
    extensionName: 'metrics-collector-extension',
    extensionType: 'internal',
    initLoad: 'before'
  });

  // Setup initialization hook
  hooks.onInit(async (event) => {
    console.log(`Metrics extension initialized for ${event.functionName}`);
    // Capture function configuration for context
    metrics.functionName = event.functionName;
    metrics.functionVersion = event.functionVersion;
    metrics.accountId = event.accountId;
    
    // You could initialize external connections here
    // await connectToMetricsService();
  });

  // Setup multiple invocation hooks with different priority patterns
  hooks.onInvoke([
    // Function with no explicit priority (uses default or options priority)
    async (event) => {
      console.log(`Function invoked with request ID: ${event.requestId}`);
      
      // Flip cold start flag after first invocation
      if (metrics.coldStarts) {
        metrics.coldStarts = false;
      }
    },
    
    // Object with handler and specific priority
    {
      handler: async (event) => {
        console.log(`Function 2 invoked with request ID: ${event.requestId}`);
        const invocationStart = Date.now();

        metrics.invocations++;
        
        // Track request IDs to correlate with function logs
        const requestId = event.requestId;
        
        try {
          // Simulate async work that runs alongside the function
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Record invocation duration
          metrics.invocationTimes.push({
            requestId,
            duration: Date.now() - invocationStart,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          metrics.errors++;
          console.error(`Error processing metrics for invocation ${requestId}:`, error);
        }
      },
      priority: 20  // This will run first due to highest priority
    },
    
    // Function with default priority
    async (event) => {
      if (event.tracing) {
        console.log(`Tracing enabled: ${event.tracing.value}`);
        // You could send trace data to an observability service here
      }
    }
  ]);

  // Setup shutdown hook
  hooks.onShutdown(async (event) => {
    // Calculate runtime statistics
    const uptime = Date.now() - metrics.startTime;
    const avgInvocationTime = metrics.invocationTimes.reduce(
      (sum, inv) => sum + inv.duration, 0
    ) / Math.max(1, metrics.invocationTimes.length);
    
    // Log shutdown metrics
    console.log(`Metrics extension shutting down: ${event.shutdownReason}`);
    console.log('Final metrics:', {
      functionName: metrics.functionName,
      totalInvocations: metrics.invocations,
      errors: metrics.errors,
      uptime,
      avgInvocationTime
    });
    
    // In real extension, you would send these metrics to your monitoring service
    // await sendMetricsToMonitoringService(metrics);
  });

  // Start the extension
  await hooks.start();
  return hooks;  
})().catch(error => {
  console.error('Failed to start metrics extension:', error);
  process.exit(1);
});