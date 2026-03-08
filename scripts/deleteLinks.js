#!/usr/bin/env node
/**
 * Delete links from data/messages.json and regenerate categorized_links.json
 *
 * Usage:
 *   node scripts/deleteLinks.js '<JSON array of URLs>'
 *   node scripts/deleteLinks.js --file deletions.json
 *   echo '<JSON array>' | node scripts/deleteLinks.js --stdin
 *
 * Tip: Use the "Copy to Clipboard" button on the /links page pending
 * deletions panel, then paste as the argument.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const MESSAGES_PATH = path.join(__dirname, '..', 'data', 'messages.json');

function printUsage() {
  console.log(`
Usage:
  node scripts/deleteLinks.js '<JSON array of URLs>'
  node scripts/deleteLinks.js --file <path-to-json-file>
  echo '<JSON>' | node scripts/deleteLinks.js --stdin

The JSON should be an array of URL strings, e.g.:
  ["https://example.com/page1", "https://example.com/page2"]
  `);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  if (args[0] === '--stdin') {
    return { mode: 'stdin' };
  }

  if (args[0] === '--file') {
    if (!args[1]) {
      console.error('Error: --file requires a path argument');
      process.exit(1);
    }
    return { mode: 'file', filePath: args[1] };
  }

  return { mode: 'arg', json: args[0] };
}

async function readStdin() {
  const rl = readline.createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) {
    lines.push(line);
  }
  return lines.join('\n');
}

function parseUrls(jsonString) {
  let urls;
  try {
    urls = JSON.parse(jsonString);
  } catch (e) {
    console.error('Error: Could not parse JSON input.');
    console.error('  Expected a JSON array of URL strings.');
    console.error('  Parse error:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(urls)) {
    console.error('Error: Input must be a JSON array of URL strings.');
    process.exit(1);
  }

  if (urls.length === 0) {
    console.log('No URLs provided. Nothing to delete.');
    process.exit(0);
  }

  const invalid = urls.filter(u => typeof u !== 'string');
  if (invalid.length > 0) {
    console.error('Error: All entries must be strings. Found:', invalid);
    process.exit(1);
  }

  return urls;
}

async function confirm(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const config = parseArgs();

  // 1. Get the URL list
  let jsonString;
  if (config.mode === 'stdin') {
    jsonString = await readStdin();
  } else if (config.mode === 'file') {
    if (!fs.existsSync(config.filePath)) {
      console.error(`Error: File not found: ${config.filePath}`);
      process.exit(1);
    }
    jsonString = fs.readFileSync(config.filePath, 'utf-8');
  } else {
    jsonString = config.json;
  }

  const urlsToDelete = new Set(parseUrls(jsonString));

  // 2. Read messages.json
  if (!fs.existsSync(MESSAGES_PATH)) {
    console.error(`Error: ${MESSAGES_PATH} not found.`);
    process.exit(1);
  }
  const messages = JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf-8'));
  console.log(`Loaded ${messages.length} messages from messages.json`);

  // 3. Find matching messages
  const toRemove = [];
  const notFound = new Set(urlsToDelete);

  messages.forEach((msg, index) => {
    if (!msg.links) return;
    const hasMatch = msg.links.some(link => urlsToDelete.has(link));
    if (hasMatch) {
      toRemove.push({ index, message: msg });
      msg.links.forEach(link => notFound.delete(link));
    }
  });

  // 4. Report
  console.log(`\n--- Deletion Summary ---`);
  console.log(`URLs requested: ${urlsToDelete.size}`);
  console.log(`Messages to remove: ${toRemove.length}`);

  if (toRemove.length > 0) {
    console.log(`\nWill remove:`);
    toRemove.forEach(({ message }) => {
      const url = message.links?.[0] || '(no link)';
      console.log(`  - ${url}`);
    });
  }

  if (notFound.size > 0) {
    console.log(`\nNot found in messages.json (${notFound.size}):`);
    [...notFound].forEach(url => console.log(`  - ${url}`));
  }

  if (toRemove.length === 0) {
    console.log('\nNothing to delete.');
    process.exit(0);
  }

  // 5. Confirm
  const answer = await confirm(`\nProceed with deleting ${toRemove.length} messages? (yes/no): `);
  if (answer !== 'yes' && answer !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  // 6. Remove and write
  const removeIndices = new Set(toRemove.map(r => r.index));
  const remaining = messages.filter((_, i) => !removeIndices.has(i));
  fs.writeFileSync(MESSAGES_PATH, JSON.stringify(remaining, null, 2), 'utf-8');
  console.log(`\nWrote ${remaining.length} messages (removed ${toRemove.length})`);

  // 7. Regenerate categorized_links.json
  console.log('Regenerating categorized_links.json...');
  const { processMessages } = require('./processLinks');
  processMessages();

  console.log('\nDone! Remember to clear localStorage deletedLinks in your browser.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
