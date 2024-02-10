#!/bin/bash

# Ensure the script fails if any commands fail
set -e

# Access the script input. Be cautious with untrusted content.
SCRIPT="${INPUT_SCRIPT}"

# Optional: Write the script to a file if it's complex or multiline
echo "$SCRIPT" >/tmp/script.sh
chmod +x /tmp/script.sh

# Execute the script
# Using 'bash' to execute to support more complex scripts
bash /tmp/script.sh

# Cleanup if necessary
rm /tmp/script.sh
