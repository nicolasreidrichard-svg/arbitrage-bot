#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Run all test suites
echo "Running tests..."
# Assuming you're using a testing framework like Jest, Mocha, etc.
# You may need to adjust the command based on the actual testing framework in use.
npm test -- --coverage

echo "Tests completed."