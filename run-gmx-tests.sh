#!/bin/bash

# Ensure compiled JavaScript is up to date
echo "Compiling TypeScript..."
npx tsc

# Run the tests with Mocha
echo "Running GMX Flow API tests with Mocha..."
NODE_ENV=development npx mocha dist/tests/gmx-flow-api.test.js --timeout 15000
