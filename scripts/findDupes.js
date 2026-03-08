#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const MESSAGES_PATH = path.join(__dirname, '..', 'data', 'messages.json');
const msgs = JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf-8'));

// Parse timestamps into comparable dates
function parseTimestamp(ts) {
  if (!ts) return new Date(0);
  // Try ISO format first
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d;
  // Try " — MM/DD/YY, H:MM AM/PM" format
  const match = ts.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+)\s*(AM|PM)?/i);
  if (match) {
    let [, month, day, year, hour, min, ampm] = match;
    year = parseInt(year) < 100 ? 2000 + parseInt(year) : parseInt(year);
    hour = parseInt(hour);
    if (ampm && ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return new Date(year, parseInt(month) - 1, parseInt(day), hour, parseInt(min));
  }
  return new Date(0);
}

// Group by URL
const byUrl = {};
msgs.forEach((msg, i) => {
  const url = msg.links && msg.links[0];
  if (!url) return;
  if (!byUrl[url]) byUrl[url] = [];
  byUrl[url].push({ index: i, timestamp: msg.timestamp, parsed: parseTimestamp(msg.timestamp) });
});

// Find duplicates
const dupes = Object.entries(byUrl).filter(([_, entries]) => entries.length > 1);
const toRemove = [];

dupes.forEach(([url, entries]) => {
  // Sort by parsed timestamp ascending (oldest first)
  entries.sort((a, b) => a.parsed - b.parsed);
  // Keep the oldest (index 0), remove the rest
  const keep = entries[0];
  const remove = entries.slice(1);
  remove.forEach(r => toRemove.push(r.index));
});

console.log('Duplicate URLs found:', dupes.length);
console.log('Total entries to remove (newer dupes):', toRemove.length);
console.log('');

dupes.forEach(([url, entries]) => {
  entries.sort((a, b) => a.parsed - b.parsed);
  console.log(url.slice(0, 90));
  entries.forEach((e, i) => {
    const tag = i === 0 ? 'KEEP  ' : 'REMOVE';
    console.log('  ' + tag + ' | idx ' + e.index + ' | ' + e.timestamp);
  });
});

// Apply?
if (process.argv[2] === '--apply') {
  const removeSet = new Set(toRemove);
  const remaining = msgs.filter((_, i) => !removeSet.has(i));
  fs.writeFileSync(MESSAGES_PATH, JSON.stringify(remaining, null, 2));
  console.log('\nApplied! Removed ' + toRemove.length + ' duplicates. ' + remaining.length + ' messages remain.');

  console.log('Regenerating categorized_links.json...');
  const { processMessages } = require('./processLinks');
  processMessages();
  console.log('Done!');
} else {
  console.log('\nDry run. To apply, run: node scripts/findDupes.js --apply');
}
