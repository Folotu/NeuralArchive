#!/usr/bin/env node
/**
 * Filter messages to only include research-related links
 * Creates a public-safe messages.json file
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PRIVATE_MESSAGES_PATH = path.join(ROOT, 'data', 'private', 'discord-messages.json');
const PUBLIC_MESSAGES_PATH = path.join(ROOT, 'data', 'messages.json');

// Import the same filtering logic from processLinks.js
const RESEARCH_KEYWORDS = [
  // Robotics & AI
  'robot', 'robotics', 'ai', 'artificial intelligence', 'machine learning',
  'deep learning', 'neural', 'automation', 'computer vision', 'manipulation',
  'locomotion', 'reinforcement learning', 'rl', 'sim2real', 'simulation',
  'isaac', 'gazebo', 'mujoco', 'embodied', 'perception', 'navigation',
  'grasping', 'humanoid', 'legged', 'dexterous', 'teleoperation', 'control',
  'planning', 'slam', 'dataset', 'benchmark', 'foundation model', 'transformer',
  'diffusion', 'policy', 'imitation', 'llm', 'gpt', 'language model',
  // General Tech & Learning
  'programming', 'coding', 'software', 'engineer', 'developer', 'algorithm',
  'data structure', 'tutorial', 'course', 'documentation', 'api', 'framework',
  'research', 'paper', 'arxiv', 'github.com', 'python', 'c++', 'javascript',
  'leetcode', 'interview', 'nvidia', 'openai', 'google', 'meta', 'amazon'
];

const EXCLUDE_DOMAINS = [
  'discord.gg', 'paypal.me', 'amazon.com', 'taobao.com', 'instagram.com',
  'soundcloud.com', 'distrokid.com', 'yupoo.com', 'workday', 'handshake.com',
  'hackerrank.com', 'datacamp.com', 'codefinity.com', 'reddit.com/r/fashion',
  'rutracker.org', 'm.intl.taobao.com', 'apartment', 'rent', 'tinder',
  'beamjobs', 'spotify', 'soundcloud'
];

function isResearchRelated(url, content) {
  const text = `${content} ${url}`.toLowerCase();

  // Check if any research keyword is present
  const hasKeyword = RESEARCH_KEYWORDS.some(keyword => text.includes(keyword));

  // Check if it's not from an excluded domain
  const isExcluded = EXCLUDE_DOMAINS.some(domain => url.toLowerCase().includes(domain));

  return hasKeyword && !isExcluded;
}

// Check if timestamp has a full date or is time-only
function hasFullDate(timestamp) {
  // Full date format: " — 12/27/24, 4:07 PM"
  return /\d{1,2}\/\d{1,2}\/\d{2}/.test(timestamp);
}

function filterMessages() {
  console.log('🔍 Filtering messages...');

  // Read private messages
  if (!fs.existsSync(PRIVATE_MESSAGES_PATH)) {
    console.error(`❌ File not found: ${PRIVATE_MESSAGES_PATH}`);
    console.log('   Make sure messages.json exists in data/private/');
    process.exit(1);
  }

  const privateMessages = JSON.parse(fs.readFileSync(PRIVATE_MESSAGES_PATH, 'utf-8'));
  console.log(`📖 Read ${privateMessages.length} total messages`);

  // Filter messages while preserving date context
  const filteredMessages = [];
  let lastFullDateMessage = null;
  let lastFullDateIncluded = false;

  for (let i = 0; i < privateMessages.length; i++) {
    const message = privateMessages[i];

    // Track the last message with a full date
    if (hasFullDate(message.timestamp)) {
      lastFullDateMessage = message;
      lastFullDateIncluded = false;
    }

    // Check if this message passes the research filter
    if (!message.links || message.links.length === 0) continue;

    const isResearch = message.links.some(url => isResearchRelated(url, message.content || ''));

    if (isResearch) {
      // If this message has time-only timestamp and we haven't included the date anchor yet
      if (!hasFullDate(message.timestamp) && lastFullDateMessage && !lastFullDateIncluded) {
        filteredMessages.push(lastFullDateMessage);
        lastFullDateIncluded = true;
        console.log(`   ⚓ Added date anchor: ${lastFullDateMessage.timestamp}`);
      }

      filteredMessages.push(message);
    }
  }

  console.log(`✅ Filtered to ${filteredMessages.length} research-related messages`);

  // Ensure output directory exists
  const outputDir = path.dirname(PUBLIC_MESSAGES_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write filtered messages
  fs.writeFileSync(
    PUBLIC_MESSAGES_PATH,
    JSON.stringify(filteredMessages, null, 2),
    'utf-8'
  );

  console.log(`💾 Saved to ${PUBLIC_MESSAGES_PATH}`);

  // Stats
  const totalLinks = privateMessages.reduce((sum, msg) => sum + (msg.links?.length || 0), 0);
  const filteredLinks = filteredMessages.reduce((sum, msg) => sum + (msg.links?.length || 0), 0);

  console.log('\n📊 Summary:');
  console.log(`   - Total messages: ${privateMessages.length} → ${filteredMessages.length}`);
  console.log(`   - Total links: ${totalLinks} → ${filteredLinks}`);
  console.log(`   - Filtered out: ${privateMessages.length - filteredMessages.length} messages (${totalLinks - filteredLinks} links)`);
}

try {
  filterMessages();
} catch (error) {
  console.error('❌ Filtering failed:', error);
  process.exit(1);
}
