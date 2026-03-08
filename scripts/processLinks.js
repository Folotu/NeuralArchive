/**
 * Process messages and extract research links with faceted metadata
 *
 * This script:
 * 1. Reads messages.json
 * 2. Filters for robotics/AI research-related links
 * 3. Classifies each link with multi-label facets (type, areas, topics, platform)
 * 4. Generates categorized_links.json with faceted structure
 */

const fs = require('fs');
const path = require('path');
const { classifyLink } = require('./classifyLink');

// Research/Tech-related keywords for filtering
const RESEARCH_KEYWORDS = [
  'robot', 'robotics', 'ai', 'artificial intelligence', 'machine learning',
  'deep learning', 'neural', 'automation', 'computer vision', 'manipulation',
  'locomotion', 'reinforcement learning', 'rl', 'sim2real', 'simulation',
  'isaac', 'gazebo', 'mujoco', 'embodied', 'perception', 'navigation',
  'grasping', 'humanoid', 'legged', 'dexterous', 'teleoperation', 'control',
  'planning', 'slam', 'dataset', 'benchmark', 'foundation model', 'transformer',
  'diffusion', 'policy', 'imitation', 'llm', 'gpt', 'language model',
  'programming', 'coding', 'software', 'engineer', 'developer', 'algorithm',
  'data structure', 'tutorial', 'course', 'documentation', 'api', 'framework',
  'research', 'paper', 'arxiv', 'github.com', 'python', 'c++', 'javascript',
  'leetcode', 'interview', 'nvidia', 'openai', 'google', 'meta', 'amazon'
];

// Domains to exclude
const EXCLUDE_DOMAINS = [
  'discord.gg', 'paypal.me', 'amazon.com', 'taobao.com', 'instagram.com',
  'soundcloud.com', 'distrokid.com', 'yupoo.com', 'workday', 'handshake.com',
  'hackerrank.com', 'datacamp.com', 'codefinity.com', 'reddit.com/r/fashion',
  'rutracker.org', 'm.intl.taobao.com'
];

// Unrelated URL patterns
const UNRELATED_PATTERNS = /apartment|rent|housing|equity|paypal|discord\.gg|soundcloud|distrokid|tinder|beamjobs/i;

// Check if link is research/tech-related
function isResearchRelated(url, content) {
  const text = `${content} ${url}`.toLowerCase();
  const hasKeyword = RESEARCH_KEYWORDS.some(keyword => text.includes(keyword));
  const isExcluded = EXCLUDE_DOMAINS.some(domain => url.toLowerCase().includes(domain));
  if (UNRELATED_PATTERNS.test(url)) return false;
  return hasKeyword && !isExcluded;
}

// Extract title from content or URL
function extractTitle(content, url) {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('http') && !trimmed.includes('://') &&
        trimmed.length > 10 && trimmed.length < 200) {
      return trimmed;
    }
  }
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/').filter(p => p && p.length > 2);
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1]
        .replace(/[-_]/g, ' ')
        .replace(/\.(html?|php|aspx?)$/i, '')
        .trim();
      if (lastPart.length > 3) {
        return `${lastPart.charAt(0).toUpperCase()}${lastPart.slice(1)}`;
      }
    }
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url.slice(0, 50) + '...';
  }
}

// Parse timestamp to ISO format
function parseTimestamp(timestamp, index, lastKnownDate) {
  try {
    const fullDateMatch = timestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (fullDateMatch) {
      let [, month, day, year, hour, minute, ampm] = fullDateMatch;
      year = parseInt(year) < 100 ? `20${year}` : year;
      hour = parseInt(hour);
      if (ampm && ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      const date = new Date(year, month - 1, day, hour, minute);
      return { timestamp: date.toISOString(), lastKnownDate: date };
    }

    const timeOnlyMatch = timestamp.match(/\[(\d{1,2}):(\d{2})\s*(AM|PM)?\]/i);
    if (timeOnlyMatch && lastKnownDate) {
      let [, hour, minute, ampm] = timeOnlyMatch;
      hour = parseInt(hour);
      if (ampm && ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      const date = new Date(lastKnownDate);
      date.setHours(hour, parseInt(minute), 0, 0);
      return { timestamp: date.toISOString(), lastKnownDate };
    }
  } catch {}

  const date = lastKnownDate ? new Date(lastKnownDate) : new Date();
  date.setMinutes(date.getMinutes() - index);
  return { timestamp: date.toISOString(), lastKnownDate };
}

// Build facet index (precomputed counts for frontend sidebar)
function buildFacetIndex(links) {
  const index = {
    resourceType: {},
    researchAreas: {},
    topics: {},
    sourcePlatform: {}
  };

  for (const link of links) {
    const f = link.facets;

    // Single-value facets
    index.resourceType[f.resourceType] = (index.resourceType[f.resourceType] || 0) + 1;
    index.sourcePlatform[f.sourcePlatform] = (index.sourcePlatform[f.sourcePlatform] || 0) + 1;

    // Multi-value facets
    for (const area of f.researchAreas) {
      index.researchAreas[area] = (index.researchAreas[area] || 0) + 1;
    }
    for (const topic of f.topics) {
      index.topics[topic] = (index.topics[topic] || 0) + 1;
    }
  }

  // Sort each facet by count descending
  for (const facetName of Object.keys(index)) {
    const sorted = Object.entries(index[facetName])
      .sort((a, b) => b[1] - a[1]);
    index[facetName] = Object.fromEntries(sorted);
  }

  return index;
}

// Main processing function
function processMessages() {
  console.log('📖 Reading messages.json...');

  const inputPath = path.join(__dirname, '..', 'data', 'messages.json');
  const outputPath = path.join(__dirname, '..', 'observatory', 'src', 'categorized_links.json');

  if (!fs.existsSync(inputPath)) {
    console.error('❌ messages.json not found!');
    process.exit(1);
  }

  const messages = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  console.log(`📖 Found ${messages.length} messages`);

  const links = [];
  let lastKnownDate = null;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    const { timestamp, lastKnownDate: newLastKnownDate } = parseTimestamp(
      message.timestamp, i, lastKnownDate
    );
    if (newLastKnownDate) lastKnownDate = newLastKnownDate;

    if (!message.links || message.links.length === 0) continue;

    for (const url of message.links) {
      if (!isResearchRelated(url, message.content)) continue;

      // Use enriched title if available, otherwise extract
      const enrichedTitle = message.enriched && message.enriched.title;
      const title = enrichedTitle || extractTitle(message.content, url);

      // Classify with the faceted scoring engine
      const classification = classifyLink(message);

      links.push({
        link: url,
        title: title,
        description: message.content.length > 200
          ? message.content.slice(0, 200) + '...'
          : message.content,
        content: message.content,
        timestamp: timestamp,
        author: {
          name: message.author || 'Unknown',
          handle: `@${message.author || 'unknown'}`,
          avatar: 'https://via.placeholder.com/50',
          affiliation: ''
        },
        facets: classification.facets,
        significance: classification.significance,
        confidence: classification.confidence
      });
    }
  }

  console.log(`\n✅ Extracted ${links.length} research links`);

  // Build facet index
  const facetIndex = buildFacetIndex(links);

  // Log summary
  console.log(`\n📊 Resource types:`);
  Object.entries(facetIndex.resourceType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  console.log(`\n🔬 Research areas:`);
  Object.entries(facetIndex.researchAreas).slice(0, 10).forEach(([area, count]) => {
    console.log(`   ${area}: ${count}`);
  });

  console.log(`\n🏷️  Top topics:`);
  Object.entries(facetIndex.topics).slice(0, 10).forEach(([topic, count]) => {
    console.log(`   ${topic}: ${count}`);
  });

  console.log(`\n🌐 Platforms:`);
  Object.entries(facetIndex.sourcePlatform).forEach(([platform, count]) => {
    console.log(`   ${platform}: ${count}`);
  });

  // Write output
  const output = { links, facetIndex };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved to ${outputPath}`);
  console.log(`📁 ${links.length} links with ${Object.keys(facetIndex.topics).length} unique topics`);

  return output;
}

// Run
if (require.main === module) {
  try {
    processMessages();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

module.exports = { processMessages };
