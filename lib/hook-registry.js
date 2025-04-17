/**
 * Create a hook registry for managing event handlers
 */
export function createHookRegistry() {
  // Initialize hook storage
  const hooks = {
    INIT: [],
    INVOKE: [],
    SHUTDOWN: []
  };
  
  return {
    /**
     * Register a hook for a specific event type
     * @param {string} eventType - Event type (INIT, INVOKE, SHUTDOWN)
     * @param {Function|Function[]|Object|Object[]} handler - Async function(s) to execute
     *   Can be:
     *   - A single function
     *   - An array of functions
     *   - An object with { handler, priority }
     *   - An array of objects with { handler, priority }
     * @param {Object} [options] - Hook options (optional)
     * @param {number} [options.priority] - Execution priority (higher numbers run first)
     */
    register(eventType, handler, options = {}) {
      if (!hooks[eventType]) {
        throw new LambdaHookError(
          'INVALID_EVENT_TYPE',
          `Invalid event type: ${eventType}`
        );
      }
      
      // Handle array of handlers or handler objects
      if (Array.isArray(handler)) {
        handler.forEach(item => {
          // Check if item is an object with handler property (for { handler, priority } format)
          if (item && typeof item === 'object' && typeof item.handler === 'function') {
            hooks[eventType].push({
              handler: item.handler,
              priority: item.priority || options.priority || 0
            });
          } 
          // Check if item is a function
          else if (typeof item === 'function') {
            hooks[eventType].push({
              handler: item,
              priority: options.priority || 0
            });
          } 
          else {
            throw new LambdaHookError(
              'INVALID_HANDLER',
              'Each item in the array must be a function or an object with a handler function'
            );
          }
        });
      } 
      // Handle object with handler property (for { handler, priority } format)
      else if (handler && typeof handler === 'object' && typeof handler.handler === 'function') {
        hooks[eventType].push({
          handler: handler.handler,
          priority: handler.priority || options.priority || 0
        });
      }
      // Handle single handler function
      else if (typeof handler === 'function') {
        hooks[eventType].push({
          handler,
          priority: options.priority || 0
        });
      } 
      else {
        throw new LambdaHookError(
          'INVALID_HANDLER',
          'Handler must be a function, an array of functions, or an object with a handler function'
        );
      }
      
      // Sort hooks by priority (higher numbers execute first)
      hooks[eventType].sort((a, b) => b.priority - a.priority);
    },
    
    /**
     * Execute all hooks for a specific event type
     * @param {string} eventType - Event type (INIT, INVOKE, SHUTDOWN)
     * @param {Object} event - Event data to pass to hooks
     */
    async executeHooks(eventType, event) {
      if (!hooks[eventType] || hooks[eventType].length === 0) {
        return;
      }
      
      // Create an array of promises for each hook
      const hookPromises = hooks[eventType].map(async ({ handler }) => {
        try {
          return await handler(event);
        } catch (error) {
          console.error(`Error executing ${eventType} hook:`, error);
          // Throw the error wrapped in a LambdaHookError
          throw new LambdaHookError(
            'HOOK_EXECUTION_ERROR',
            `Error executing ${eventType} hook`,
            error
          );
        }
      });
      
      // Execute all hooks concurrently
      await Promise.all(hookPromises);
    }
  };
}