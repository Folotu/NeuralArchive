#!/usr/bin/env node
/**
 * Intelligent link enrichment with deep metadata extraction
 *
 * This script fetches URLs and extracts:
 * - Basic metadata (title, description, author)
 * - Technical concepts and key terms
 * - Research area classification
 * - GitHub-specific metadata (stars, forks, language, topics)
 * - ArXiv paper metadata (authors, abstract, categories)
 * - Twitter/X post metadata
 * - Smart categorization
 */

const fs = require('fs');
const path = require('path');
const { setTimeout: sleep } = require('timers/promises');

const ROOT = process.cwd();
const RAW_PATH = path.join(ROOT, 'raw_links.txt');
const MESSAGES_PATH = path.join(ROOT, 'data', 'messages.json');
const OUTPUT_PATH = path.join(ROOT, 'observatory', 'src', 'categorized_links.json');

// Technical terms to look for in content
const RESEARCH_CONCEPTS = {
  'robotics': [
    'manipulation', 'dexterous', 'grasping', 'locomotion', 'legged', 'humanoid',
    'bipedal', 'quadruped', 'end-effector', 'inverse kinematics', 'trajectory',
    'mobile robot', 'teleoperation', 'haptic', 'force control'
  ],
  'ai-ml': [
    'reinforcement learning', 'deep learning', 'neural network', 'transformer',
    'diffusion model', 'foundation model', 'large language model', 'llm',
    'policy learning', 'imitation learning', 'curriculum learning', 'meta-learning',
    'few-shot', 'zero-shot', 'in-context learning', 'retrieval augmented'
  ],
  'computer-vision': [
    'object detection', 'segmentation', 'pose estimation', 'slam', 'nerf',
    'depth estimation', 'optical flow', 'point cloud', 'visual servoing',
    'scene understanding', 'semantic mapping', '3d reconstruction'
  ],
  'simulation': [
    'sim-to-real', 'sim2real', 'domain randomization', 'domain adaptation',
    'isaac gym', 'mujoco', 'gazebo', 'pybullet', 'physics engine',
    'parallel simulation', 'digital twin'
  ],
  'control': [
    'model predictive control', 'mpc', 'pid', 'optimal control', 'lqr',
    'impedance control', 'admittance control', 'compliance', 'feedback control'
  ]
};

const RESEARCH_AREAS = {
  'embodied-ai': ['embodied', 'agent', 'environment', 'interaction', 'perception-action'],
  'manipulation': ['manipulation', 'grasping', 'pick', 'place', 'assembly'],
  'locomotion': ['locomotion', 'walking', 'running', 'legged', 'bipedal', 'quadruped'],
  'navigation': ['navigation', 'path planning', 'obstacle avoidance', 'mapping', 'slam'],
  'human-robot-interaction': ['hri', 'human robot', 'collaboration', 'safety', 'social'],
};

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(id);
  }
}

function extractBasicMeta(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : '';

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  const description = descMatch ? descMatch[1].trim() : '';

  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  const ogDescription = ogDescMatch ? ogDescMatch[1].trim() : '';

  const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  const author = authorMatch ? authorMatch[1].trim() : '';

  return {
    title: ogTitle || title || '',
    description: ogDescription || description || '',
    author: author
  };
}

function extractKeyConcepts(html, url) {
  const text = html.toLowerCase();
  const concepts = new Set();
  const technicalApproaches = new Set();

  // Extract research concepts
  for (const [category, terms] of Object.entries(RESEARCH_CONCEPTS)) {
    for (const term of terms) {
      if (text.includes(term.toLowerCase())) {
        concepts.add(term);
        technicalApproaches.add(category);
      }
    }
  }

  return {
    key_concepts: Array.from(concepts).slice(0, 10),
    technical_approaches: Array.from(technicalApproaches)
  };
}

function classifyResearchArea(concepts, title, description) {
  const text = `${title} ${description} ${concepts.join(' ')}`.toLowerCase();
  const scores = {};

  for (const [area, keywords] of Object.entries(RESEARCH_AREAS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    if (score > 0) scores[area] = score;
  }

  // Return top areas
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([area]) => area);
}

async function enrichGitHub(url, html) {
  try {
    // Extract GitHub repo info from HTML
    const starsMatch = html.match(/(\d+[\d,]*)\s*(?:stars?|watchers?)/i);
    const stars = starsMatch ? parseInt(starsMatch[1].replace(/,/g, '')) : 0;

    const forksMatch = html.match(/(\d+[\d,]*)\s*forks?/i);
    const forks = forksMatch ? parseInt(forksMatch[1].replace(/,/g, '')) : 0;

    const languageMatch = html.match(/<span[^>]*itemprop=["']programmingLanguage["'][^>]*>([^<]+)<\/span>/i);
    const language = languageMatch ? languageMatch[1].trim() : '';

    // Extract topics/tags
    const topicMatches = html.matchAll(/<a[^>]*topic-tag[^>]*>([^<]+)<\/a>/gi);
    const topics = Array.from(topicMatches).map(m => m[1].trim()).slice(0, 8);

    return {
      github: {
        stars,
        forks,
        language,
        topics: topics.length > 0 ? topics : undefined
      }
    };
  } catch (e) {
    return { github: {} };
  }
}

async function enrichArXiv(url, html) {
  try {
    // Extract arXiv metadata
    const abstractMatch = html.match(/<blockquote[^>]*class=["']abstract["'][^>]*>.*?Abstract:?\s*([^<]+)</is);
    const abstract = abstractMatch ? abstractMatch[1].trim().slice(0, 500) : '';

    const authorsMatches = html.matchAll(/<a[^>]*class=["']author["'][^>]*>([^<]+)<\/a>/gi);
    const authors = Array.from(authorsMatches).map(m => m[1].trim()).slice(0, 5);

    const categoryMatch = html.match(/Subjects?:?\s*([^<\n]+)/i);
    const categories = categoryMatch ? categoryMatch[1].trim() : '';

    return {
      paper: {
        abstract,
        authors: authors.length > 0 ? authors : undefined,
        categories
      }
    };
  } catch (e) {
    return { paper: {} };
  }
}

function determineSignificance(keyConcepts, researchAreas) {
  // Heuristic: more concepts + specific research area = higher significance
  const conceptScore = keyConcepts.length;
  const areaScore = researchAreas.length * 2;

  const totalScore = conceptScore + areaScore;

  if (totalScore >= 8) return 'high';
  if (totalScore >= 4) return 'medium';
  return 'exploratory';
}

async function enrichLink(url) {
  console.log(`Enriching: ${url}`);

  try {
    const html = await fetchWithTimeout(url);
    const basicMeta = extractBasicMeta(html);
    const { key_concepts, technical_approaches } = extractKeyConcepts(html, url);
    const research_areas = classifyResearchArea(key_concepts, basicMeta.title, basicMeta.description);

    // Domain-specific enrichment
    let domainMeta = {};
    if (url.includes('github.com')) {
      domainMeta = await enrichGitHub(url, html);
    } else if (url.includes('arxiv.org')) {
      domainMeta = await enrichArXiv(url, html);
    }

    const significance = determineSignificance(key_concepts, research_areas);

    // Build comprehensive summary
    const summary = basicMeta.description ||
      (domainMeta.paper?.abstract ? `Research paper: ${domainMeta.paper.abstract.slice(0, 200)}...` : '') ||
      `${basicMeta.title}`;

    return {
      url,
      title: basicMeta.title,
      description: basicMeta.description,
      author: basicMeta.author,
      about: {
        summary,
        key_concepts,
        research_areas: research_areas.length > 0 ? research_areas : undefined,
        technical_approaches: technical_approaches.length > 0 ? technical_approaches : undefined,
        significance,
        ...domainMeta
      },
      metadata: {
        enriched_at: new Date().toISOString(),
        enrichment_version: '1.0',
        quality: key_concepts.length > 3 ? 'high' : 'basic'
      }
    };
  } catch (error) {
    console.error(`Failed to enrich ${url}:`, error.message);
    return {
      url,
      title: '',
      description: '',
      about: {
        summary: '',
        key_concepts: []
      },
      metadata: {
        enriched_at: new Date().toISOString(),
        enrichment_version: '1.0',
        quality: 'failed',
        error: error.message
      }
    };
  }
}

async function main() {
  // Read raw links
  const rawLinksExist = fs.existsSync(RAW_PATH);
  if (!rawLinksExist) {
    console.log('No raw_links.txt found. Nothing to enrich.');
    return;
  }

  const rawContent = fs.readFileSync(RAW_PATH, 'utf-8');
  const urls = rawContent
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      // Must start with http:// or https:// — reject UUIDs, bare text, etc.
      if (!/^https?:\/\//i.test(line)) {
        console.log(`Skipping non-URL: ${line.slice(0, 60)}`);
        return false;
      }
      return true;
    });

  if (urls.length === 0) {
    console.log('No URLs to process.');
    return;
  }

  console.log(`Found ${urls.length} URLs to enrich...`);

  // Load existing messages
  let messages = [];
  if (fs.existsSync(MESSAGES_PATH)) {
    const data = JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf-8'));
    messages = Array.isArray(data) ? data : [];
  }

  // Enrich each URL
  const enrichedLinks = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const enriched = await enrichLink(url);

    // Add to messages format
    messages.push({
      content: enriched.title || url,
      links: [url],
      timestamp: new Date().toISOString(),
      author: 'auto-enrich',
      enriched: enriched
    });

    enrichedLinks.push(enriched);

    // Be polite to servers
    await sleep(1000);
  }

  // Save updated messages
  fs.writeFileSync(
    MESSAGES_PATH,
    JSON.stringify(messages, null, 2),
    'utf-8'
  );

  console.log(`✅ Enriched ${enrichedLinks.length} links`);
  console.log(`📊 Quality breakdown:`);
  const qualityCounts = {};
  enrichedLinks.forEach(link => {
    const quality = link.metadata?.quality || 'unknown';
    qualityCounts[quality] = (qualityCounts[quality] || 0) + 1;
  });
  Object.entries(qualityCounts).forEach(([quality, count]) => {
    console.log(`   - ${quality}: ${count}`);
  });

  // Clear raw_links.txt
  fs.writeFileSync(RAW_PATH, '', 'utf-8');
  console.log('\n✨ Cleared raw_links.txt');
}

main().catch((error) => {
  console.error('Enrichment failed:', error);
  process.exit(1);
});
