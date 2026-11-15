// Sample slow hook: takes 3 seconds, so a 1 second timeout cuts it off.
setTimeout(() => process.exit(0), 3000);
