
// lib/extension-client.js - Client for the Extensions API
import http from 'http';
import { URL } from 'url';
import { LambdaHookError } from './errors.js';

/**
 * Create a client for interacting with the Lambda Extensions API
 */
export function createExtensionClient(options) {
  const { extensionName, extensionType, includeAccountId } = options;
  const apiBaseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-01-01/extension/`;
  
  /**
   * Make an HTTP request to the Extensions API
   * @private
   */
  async function makeRequest(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, apiBaseUrl);
      
      const reqOptions = {
        method,
        headers: { ...headers }
      };
      
      const req = http.request(url, reqOptions, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString();
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            let parsedBody;
            try {
              parsedBody = responseBody ? JSON.parse(responseBody) : {};
            } catch (e) {
              parsedBody = responseBody;
            }
            
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: parsedBody
            });
          } else {
            reject(
              new LambdaHookError(
                'API_ERROR',
                `API request failed with status ${res.statusCode}`,
                { statusCode: res.statusCode, body: responseBody }
              )
            );
          }
        });
      });
      
      req.on('error', (error) => {
        reject(
          new LambdaHookError(
            'NETWORK_ERROR',
            'Network error during API request',
            error
          )
        );
      });
      
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      
      req.end();
    });
  }
  
  return {
    /**
     * Register the extension with the Lambda Extensions API
     * @param {string[]} events - Events to register for (INVOKE, SHUTDOWN)
     * @returns {Promise<Object>} - Registration response
     */
    async register(events) {
      const headers = {
        'Lambda-Extension-Name': extensionName
      };
      
      if (includeAccountId) {
        headers['Lambda-Extension-Accept-Feature'] = 'accountId';
      }
      
      const response = await makeRequest(
        'POST',
        'register',
        headers,
        { events }
      );
      
      if (!response.headers['lambda-extension-identifier']) {
        throw new LambdaHookError(
          'INVALID_RESPONSE',
          'Extension ID not received in registration response'
        );
      }
      
      return {
        extensionId: response.headers['lambda-extension-identifier'],
        functionName: response.body.functionName,
        functionVersion: response.body.functionVersion,
        handler: response.body.handler,
        accountId: response.body.accountId
      };
    },
    
    /**
     * Get the next event from the Extensions API
     * @param {string} extensionId - Extension ID from registration
     * @returns {Promise<Object>} - Next event
     */
    async nextEvent(extensionId) {
      if (!extensionId) {
        throw new LambdaHookError(
          'INVALID_STATE',
          'Extension ID is required for next event'
        );
      }
      
      const response = await makeRequest(
        'GET',
        'event/next',
        { 'Lambda-Extension-Identifier': extensionId }
      );
      
      return {
        eventType: response.body.eventType,
        deadlineMs: response.body.deadlineMs,
        requestId: response.body.requestId,
        invokedFunctionArn: response.body.invokedFunctionArn,
        tracing: response.body.tracing,
        shutdownReason: response.body.shutdownReason
      };
    },
    
    /**
     * Report an initialization error to the Extensions API
     * @param {Error} error - Error to report
     */
    async reportInitError(error) {
      if (!extensionId) {
        // If we don't have an extension ID yet, we can't report the error
        throw new LambdaHookError(
          'INVALID_STATE',
          'Cannot report init error: Extension not registered'
        );
      }
      
      const errorType = error.code || 'Extension.UnknownReason';
      const errorMessage = error.message || 'Unknown error';
      
      await makeRequest(
        'POST',
        'init/error',
        {
          'Lambda-Extension-Identifier': extensionId,
          'Lambda-Extension-Function-Error-Type': errorType
        },
        {
          errorMessage,
          errorType,
          stackTrace: error.stack ? error.stack.split('\n') : []
        }
      );
    },
    
    /**
     * Report an exit error to the Extensions API
     * @param {Error} error - Error to report
     */
    async reportExitError(error) {
      if (!extensionId) {
        throw new LambdaHookError(
          'INVALID_STATE',
          'Cannot report exit error: Extension not registered'
        );
      }
      
      const errorType = error.code || 'Extension.UnknownReason';
      const errorMessage = error.message || 'Unknown error';
      
      await makeRequest(
        'POST',
        'exit/error',
        {
          'Lambda-Extension-Identifier': extensionId,
          'Lambda-Extension-Function-Error-Type': errorType
        },
        {
          errorMessage,
          errorType,
          stackTrace: error.stack ? error.stack.split('\n') : []
        }
      );
    }
  };
}