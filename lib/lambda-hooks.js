// lib/lambda-hooks.js - Main module implementation
import { createExtensionClient } from './extension-client.js';
import { createHookRegistry } from './hook-registry.js';
import { LambdaHookError } from './errors.js';

/**
 * LambdaHooks class for integrating with Lambda Extensions API
 */
class LambdaHooks {
  #extensionClient;
  #hookRegistry;
  #isRunning = false;
  #extensionId = null;
  #extensionType;
  #initLoad;
  /**
   * Create a new LambdaHooks instance
   * @param {Object} options - Configuration options
   * @param {string} options.extensionName - Extension name (required)
   * @param {boolean} options.includeAccountId - Whether to request accountId in registration
   */
  constructor(options = {}) {


    const { extensionName, extensionType, initLoad, includeAccountId = false } = options;

    if (!extensionName) {
      throw new LambdaHookError('INIT_ERROR', 'Extension name is required');
    }

    if (!['internal', 'external'].includes(extensionType)) {
      throw new LambdaHookError('INIT_ERROR', `Invalid extension type: ${extensionType}. Extension type must be "internal" or "external"`)
    }

    if (!['before', 'after'].includes(initLoad)) {
      throw new LambdaHookError('INIT_ERROR', `Invalid init event load behavior: ${initLoad}. Event init load must be "before" or "after"`)
    }

    this.#extensionType = extensionType;
    this.#initLoad = initLoad;

    this.#extensionClient = createExtensionClient({
      extensionName,
      includeAccountId
    });

    this.#hookRegistry = createHookRegistry();
  }

  /**
   * Register a hook for the initialization phase
   * @param {Function} handler - Async function to execute
   * @param {Object} options - Hook options
   * @returns {LambdaHooks} - For method chaining
   */
  onInit(handler, options = {}) {
    this.#hookRegistry.register('INIT', handler, options);
    return this;
  }

  /**
   * Register a hook for the invocation phase
   * @param {Function} handler - Async function to execute
   * @param {Object} options - Hook options
   * @returns {LambdaHooks} - For method chaining
   */
  onInvoke(handler, options = {}) {
    this.#hookRegistry.register('INVOKE', handler, options);
    return this;
  }

  /**
   * Register a hook for the shutdown phase
   * @param {Function} handler - Async function to execute
   * @param {Object} options - Hook options
   * @returns {LambdaHooks} - For method chaining
   */
  onShutdown(handler, options = {}) {
    this.#hookRegistry.register('SHUTDOWN', handler, options);
    return this;
  }

  /**
   * Start the extension and begin processing events
   */
  async start() {
    if (this.#isRunning) {
      throw new LambdaHookError('ALREADY_RUNNING', 'Extension is already running');
    }

    try {
      // Register the extension
      const registrationResponse = await this.#extensionClient.register(
        this.#extensionType === 'internal' ? ['INVOKE'] : ['INVOKE', 'SHUTDOWN']
      );
      
      this.#extensionId = registrationResponse.extensionId;
      
      if (this.#initLoad === 'after') {
        await this.#extensionClient.nextEvent(this.#extensionId);  
      }
      
      // Execute INIT hooks with the registration response
      await this.#hookRegistry.executeHooks('INIT', registrationResponse);
      
      // Register OS-level signal shutdown handlers
      process.once('SIGINT', this.#handleSignal);
      process.once('SIGTERM', this.#handleSignal);

      // Start the event loop
      this.#isRunning = true;
      this.#startEventLoop();
      
    } catch (error) {
      const wrappedError = new LambdaHookError(
        'EXTENSION_REGISTRATION_FAILED',
        'Failed to register extension with Lambda',
        error
      );
      
      // Try to report init error
      try {
        await this.#extensionClient.reportInitError(wrappedError);
      } catch (reportError) {
        console.error('Failed to report initialization error:', reportError);
      }
      
      throw wrappedError;
    }
  }

  /**
   * Start the event polling loop
   * @private
   */
  async #startEventLoop() {
    while (this.#isRunning) {
      try {
        // Get the next event from the Extensions API
        const event = await this.#extensionClient.nextEvent(this.#extensionId);
        
        // Process the event
        if (event.eventType === 'SHUTDOWN') {
          await this.#handleShutdown(event);
          break;
        } else if (event.eventType === 'INVOKE') {
          await this.#handleInvoke(event);
        }
      } catch (error) {
        console.error('Error in event loop:', error);
        
        // If we encounter a fatal error, report it and exit the loop
        if (error.isFatal) {
          try {
            await this.#extensionClient.reportExitError(error);
          } catch (reportError) {
            console.error('Failed to report exit error:', reportError);
          }
          
          this.#isRunning = false;
          break;
        }
        
        // For non-fatal errors, continue the loop
      }
    }
  }

  /**
   * Handle invoke events
   * @private
   */
  async #handleInvoke(event) {
    try {
      await this.#hookRegistry.executeHooks('INVOKE', event);
    } catch (error) {
      console.error('Error executing invoke hooks:', error);
    }
  }

  /**
   * Handle shutdown events
   * @private
   */
  async #handleShutdown(event) {
    try {
      await this.#hookRegistry.executeHooks('SHUTDOWN', event);
    } catch (error) {
      console.error('Error executing shutdown hooks:', error);
    } finally {
      this.#isRunning = false;
    }
  }

  async #handleSignal(signal) {
    console.log(`Received ${signal}, Gracefully shutting down...`);
    try {
      await this.#handleShutdown({ eventType: 'SHUTDOWN', signal });
    } finally {
      process.exit(0);
    }
  }
}

export default LambdaHooks;