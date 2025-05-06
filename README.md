# lambda-extension-hooks

> _Easily create AWS Lambda Extensions with a simple hook-based API_

**lambda-extension-hooks** is a modern ESM-based Node.js module that makes it simple to create AWS Lambda Extensions. It handles all the low-level communication with the Lambda Extensions API, letting you focus on your business logic instead of the infrastructure details.

## Features

- 🔄 Simple hook-based API for Lambda lifecycle events (INIT, INVOKE, SHUTDOWN)
- 🧩 Modern ESM module with a clean, expressive API
- 🛡️ Robust error handling with detailed error reporting
- ⚡ Support for concurrent async event handlers with configurable priorities
- 📦 Designed for use as a Lambda Layer
- 📝 Comprehensive documentation

## 📋 Table of Contents

- [lambda-extension-hooks](#lambda-extension-hooks)
  - [Features](#-features)
  - [📋 Table of Contents](#-table-of-contents)
  - [🚀 Installation](#-installation)
  - [🏁 Quick Start](#-quick-start)
  - [📖 API Documentation](#-api-documentation)
    - [LambdaHooks](#lambdahooks)
      - [Constructor](#constructor)
    - [Methods](#methods)
      - [.onInit(handler, options)](#oninithandler-options)
      - [.onInvoke(handler, options)](#oninvokehandler-options)
      - [.onShutdown(handler, options)](#onshutdownhandler-options)
      - [.start()](#start)
    - [Event Objects](#event-objects)
      - [Init Event](#init-event)
      - [Invoke Event](#invoke-event)
      - [Shutdown Event](#shutdown-event)
  - [Lambda Layer Setup](#lambda-layer-setup)
  - [Error Handling](#-error-handling)
    - [Error Handling Best Practices](#error-handling-best-practices)
  - [Performance Considerations](#-performance-considerations)
  - [❓ FAQ](#-faq)
  - [🤝 Contributing](#-contributing)
  - [📄 License](#-license)

## 🚀 Installation

```bash
npm install lambda-extension-hooks
```

## 🏁 Quick Start

Create a simple extension that logs lifecycle events:

```js
import { LambdaHooks } from 'lambda-extension-hooks';

// Create a new hooks instance
const hooks = new LambdaHooks({
  extensionName: 'my-logging-extension'
  extensionType: 'internal'
});

// Register lifecycle hooks
hooks
  .onInit(async (event) => {
    console.log(`Extension initialized for function: ${event.functionName}`);
  })
  // Using an array of functions
  .onInvoke([
    async (event) => {
      console.log(`Function invoked with request ID: ${event.requestId}`);
    },
    async (event) => {
      console.log(`Execution deadline: ${new Date(event.deadlineMs).toISOString()}`);
    }
  ])
  .onShutdown(async (event) => {
    console.log(`Shutting down: ${event.shutdownReason}`);
  });

// Start the extension
await hooks.start();
```

## 📖 API Documentation

### LambdaHooks

The main class for creating Lambda Extensions.

#### Constructor

```js
const hooks = new LambdaHooks(options);
```

**Options:**

- `extensionName` (string, required): Name of your extension
- `extensionType` (string, required): Type of your extension (internal or external)
- `includeAccountId` (boolean, optional): Whether to request accountId in registration

### Methods

#### .onInit(handler, options)

Register a hook for the initialization phase.

```js
hooks.onInit(async (event) => {
  console.log(`Function: ${event.functionName}, Version: ${event.functionVersion}`);
}, { 
  priority: 10 // Higher numbers run first
});
```

#### .onInvoke(handler, options)

Register a hook for the function invocation phase. The handler can be a single function or an array of functions.

```js
// Single function approach
hooks.onInvoke(async (event) => {
  console.log(`Request ID: ${event.requestId}`);
});

// Using an array of functions
hooks.onInvoke([
  async (event) => {
    console.log(`Request ID: ${event.requestId}`);
  },
  {
    handler: async (event) => {
      console.log(`Function ARN: ${event.invokedFunctionArn}`);
    },
    priority: 10
  },
  async (event) => {
    console.log(`Deadline: ${event.deadlineMs}`);
  }
]);

// Setting a default priority for all functions in the array
hooks.onInvoke([
  async (event) => { /* ... */ },
  async (event) => { /* ... */ }
], { priority: 5 });
```

#### .onShutdown(handler, options)

Register a hook for the shutdown phase.

```js
hooks.onShutdown(async (event) => {
  console.log(`Shutdown reason: ${event.shutdownReason}`);
});
```

#### .start()

Start the extension and begin processing events.

```js
await hooks.start();
```

### Event Objects

#### Init Event

```js
{
  extensionId: '51324bd8-2333-4aab-8354-8e4e951d2d71',
  functionName: 'my-function',
  functionVersion: '$LATEST',
  handler: 'index.handler',
  accountId: '123456789012' // Only if includeAccountId was true
}
```

#### Invoke Event

```js
{
  eventType: 'INVOKE',
  deadlineMs: 1596036475071,
  requestId: '3da1f2dc-3222-475e-9205-e2e6c6318895',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function',
  tracing: {
    type: 'X-Amzn-Trace-Id',
    value: 'Root=1-5f35ae12-0c0fec141ab77a00bc047aa2;Parent=2be948a625588e32;Sampled=1'
  }
}
```

#### Shutdown Event

```js
{
  eventType: 'SHUTDOWN',
  shutdownReason: 'SPINDOWN', // or 'TIMEOUT' or 'FAILURE'
  deadlineMs: 1596036475071
}
```

## Lambda Layer Setup

This module supports deployment as a Lambda Layer, allowing you to inject custom logic at the INIT, INVOKE, and SHUTDOWN phases of your Lambda function lifecycle. You can use it in two ways:

### 1. As an External Extension
Create your extension bootstrap script:

```js
#!/usr/bin/env node
// extensions/my-extension

import { LambdaHooks } from '../nodejs/lambda-extension-hooks/index.js';

const hooks = new LambdaHooks({
  extensionName: 'my-extension',
  extensionType: 'external'
});

hooks
  .onInit(async (event) => { /* ... */ })
  .onInvoke(async (event) => { /* ... */ })
  .onShutdown(async (event) => { /* ... */ });

await hooks.start();
```

Set up your layer directory structure:

```
nodejs/
  ├── lambda-extension-hooks/
  ├── node_modules/
  └── package.json         
extensions/
  └── my-extension         
```

Make your bootstrap script executable:

```bash
chmod +x extensions/my-extension
```

Package your layer:

```bash
zip -r extension-layer.zip nodejs extensions
```

Deploy the layer:

```bash
aws lambda publish-layer-version \
  --layer-name "my-extension-layer" \
  --description "My Lambda Extension" \
  --zip-file "fileb://extension-layer.zip"
```

Attach the layer to your Lambda function:

```bash
aws lambda update-function-configuration \
  --function-name your-function-name \
  --layers arn:aws:lambda:region:account-id:layer:my-extension-layer:1
```

### 2. As an **Internal Extension**

Internal extensions run **within the Lambda function's process**, but can still be delivered as a Lambda Layer and injected automatically using `NODE_OPTIONS` with the `--import` flag (Node.js 16+ / 18+ required).

Create your preload extension file:

```js
// nodejs/lambda-extension-hooks/examples/internal-extension.js

import { LambdaHooks } from '../index.js';

const hooks = new LambdaHooks({
  extensionName: 'my-internal-extension',
  extensionType: 'internal'
});

hooks
  .onInit(async () => console.log('[internal-extension] INIT'))
  .onInvoke(async () => console.log('[internal-extension] INVOKE'))
  .onShutdown(async () => console.log('[internal-extension] SHUTDOWN'));

await hooks.start();
```

Set up your layer directory structure:
```
nodejs/
├── lambda-extension-hooks/
│ └── examples/
│ └── internal-extension.js
├── node_modules/
└── package.json
```

> Ensure that `package.json` includes `"type": "module"` if you're using `.js` files with ES module syntax.

Package your layer:

```bash
zip -r internal-extension-layer.zip nodejs
```

Publish the layer:

```bash
aws lambda publish-layer-version \
  --layer-name "internal-extension-layer" \
  --description "My Lambda Internal Extension" \
  --zip-file "fileb://internal-extension-layer.zip" \
  --compatible-runtimes nodejs18.x
```

**Attach the layer and set the environment variable:**

```bash
aws lambda update-function-configuration \
  --function-name your-function-name \
  --layers arn:aws:lambda:region:account-id:layer:internal-extension-layer:1 \
  --environment "Variables={NODE_OPTIONS=--import=/opt/lambda-extension-hooks/examples/internal-extension.js}"
```

> Lambda automatically mounts your layer to the `/opt` directory.
> By setting `NODE_OPTIONS=--import=/opt/lambda-extension-hooks/examples/internal-extension.js`, Node.js will preload your internal extension script at startup, before your function handler is invoked.

This technique allows you to inject internal logic - such as logging, metrics, observability, or custom runtime behavior - **without modifying your Lambda function code**.
It's especially useful for sharing instrumentation across multiple functions while keeping your deployments clean and decoupled.


## Error Handling

The module provides robust error handling through the `LambdaHookError` class:

```js
import { LambdaHooks, LambdaHookError } from 'lambda-extension-hooks';

hooks.onInvoke(async (event) => {
  try {
    // Your code here
  } catch (error) {
    throw new LambdaHookError(
      'CUSTOM_ERROR',
      'Something went wrong',
      error,
      false
    );
  }
});
```

### Error Handling Best Practices

- Use descriptive error codes for easier debugging  
- Only mark errors as fatal if the extension cannot continue  
- Include the original error to preserve the stack trace  
- Log errors with relevant context information  

## Performance Considerations

- **Minimize cold start impact**: Keep initialization light  
- **Be resource-conscious**: Extensions share CPU/memory  
- **Use proper error handling**: Prevent cascading failures  
- **Prioritize hooks**: Run critical logic first  
- **Handle concurrency**: Prepare for parallel invocations  
- **Keep hook logic efficient**: Avoid blocking operations  

## ❓ FAQ

**Q: Will my extension slow down my Lambda function?**  
A: With proper care, impact can be minimal. Use timeouts, optimize, and test well.

**Q: Can I use this with any Lambda runtime?**  
A: It depends. External extensions work with any Lambda runtime since they run as separate processes. Just ensure the binary is compatible with the Lambda OS (e.g. Amazon Linux 2). Internal extensions, however, must be written in the same language as the function’s runtime.

**Q: How do I debug my extension?**  
A: Use `console.log` — logs are sent to CloudWatch alongside function logs.

**Q: What's the difference between external and internal extensions?**  
A: External extensions run in a separate process. Internal ones share the runtime. This module supports botu internal and external extensions.

## 🤝 Contributing

Contributions are welcome! To contribute:

- Fork the repository  
- Create a feature branch: `git checkout -b feature/amazing-feature`
- Commit your changes: `git commit -m 'Add some amazing feature'`
- Push to GitHub: `git push origin feature/amazing-feature`  
- Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for details.
