# @pact-toolbox/preludes

Streamlines the downloading and deployment of standard Kadena contracts.

## Table of Contents

- [@pact-toolbox/preludes](#pact-toolboxpreludes)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Downloading Preludes](#downloading-preludes)
    - [Deploying Preludes](#deploying-preludes)

## Introduction

The `@pact-toolbox/preludes` module provides utilities for managing the downloading and deployment of standard Kadena contracts, known as preludes. This package aims to simplify the process of handling contract dependencies and ensuring they are properly deployed to a Kadena network.

## Installation

To install the package, run:

```bash
npm install @pact-toolbox/preludes
```

## Usage

### Downloading Preludes

You can download the necessary preludes by using the downloadPreludes function. This function resolves and downloads all specified preludes based on the provided configuration.

Example:

```typescript
import { downloadAllPreludes } from "@pact-toolbox/preludes";
import { PactToolboxClient } from "@pact-toolbox/runtime";

const myPactToolboxClient = new PactToolboxClient();
const config = {
  contractsDir: "./contracts",
  preludes: ["kadena/chainweb", "kadena/marmalade"],
  client: myPactToolboxClient,
};

await downloadAllPreludes(config);
```

### Deploying Preludes

After downloading the preludes, you can deploy them using the deployPreludes function. This function ensures that all resolved preludes are deployed to the Kadena network.

Example:

```typescript
import { deployPreludes } from "@pact-toolbox/preludes";
import { PactToolboxClient } from "@pact-toolbox/runtime";

const myPactToolboxClient = new PactToolboxClient();
const config = {
  contractsDir: "./contracts",
  preludes: ["kadena/chainweb", "kadena/marmalade"],
  client: myPactToolboxClient,
};

await deployPreludes(config);
```
