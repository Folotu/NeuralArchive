/**
 * Faceted link classifier
 *
 * Assigns multi-label facets to a link based on URL patterns,
 * enrichment metadata, and weighted keyword scoring.
 *
 * Usage:
 *   const { classifyLink } = require('./classifyLink');
 *   const facets = classifyLink(message);
 */

const fs = require('fs');
const path = require('path');

// Lazy-loaded config (cached after first call)
let _taxonomy = null;
let _vocabulary = null;
let _overrides = null;

function loadConfig() {
  if (!_taxonomy) {
    _taxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, 'taxonomy.json'), 'utf-8'));
    _vocabulary = JSON.parse(fs.readFileSync(path.join(__dirname, 'vocabulary.json'), 'utf-8'));
    const overridePath = path.join(__dirname, 'classification-overrides.json');
    _overrides = fs.existsSync(overridePath)
      ? JSON.parse(fs.readFileSync(overridePath, 'utf-8'))
      : {};
  }
  return { taxonomy: _taxonomy, vocabulary: _vocabulary, overrides: _overrides };
}

/**
 * Classify a single message into faceted labels.
 *
 * @param {Object} message - A message object from messages.json
 * @param {string[]} message.links - Array of URLs
 * @param {string} message.content - Message text
 * @param {Object} [message.enriched] - Optional enrichment data
 * @returns {Object} { facets, significance, confidence }
 */
function classifyLink(message) {
  const { vocabulary } = loadConfig();
  const url = (message.links && message.links[0]) || '';
  const urlLower = url.toLowerCase();
  const content = (message.content || '').toLowerCase();
  const enriched = message.enriched || {};
  const about = enriched.about || {};

  // Gather all text signals
  const title = (enriched.title || '').toLowerCase();
  const description = (enriched.description || '').toLowerCase();
  const allText = [content, title, description, about.summary || ''].join(' ').toLowerCase();

  // Enrichment signals
  const keyConcepts = (about.key_concepts || []).map(c => c.toLowerCase());
  const enrichedAreas = (about.research_areas || []).map(a => a.toLowerCase());
  const techApproaches = (about.technical_approaches || []).map(t => t.toLowerCase());
  const githubTopics = (about.github && about.github.topics) || [];
  const significance = about.significance || 'exploratory';

  // 1. Assign resourceType + sourcePlatform via domain rules
  let resourceType = 'other-webpage';
  let sourcePlatform = 'other';
  let typeConfidence = 0.3;

  for (const rule of vocabulary.domainRules) {
    const regex = new RegExp(rule.pattern, 'i');
    if (regex.test(url)) {
      resourceType = rule.resourceType;
      if (rule.sourcePlatform) {
        sourcePlatform = rule.sourcePlatform;
      }
      typeConfidence = 0.95;
      break;
    }
  }

  // Fallback platform detection if not matched
  if (sourcePlatform === 'other') {
    try {
      const hostname = new URL(url).hostname;
      if (hostname.includes('github.io')) sourcePlatform = 'personal-blog';
      else if (hostname.match(/\.(edu|ac\.\w+)$/)) sourcePlatform = 'docs-site';
      else if (hostname.match(/blog|medium\.com|substack/)) sourcePlatform = 'personal-blog';
    } catch {}
  }

  // Fallback type detection for unmatched URLs
  if (resourceType === 'other-webpage') {
    if (allText.match(/tutorial|how to|guide|getting started|learn/)) {
      resourceType = 'article';
      typeConfidence = 0.5;
    } else if (allText.match(/company|startup|founded|team|about us|our mission/)) {
      resourceType = 'company';
      typeConfidence = 0.45;
    } else if (urlLower.match(/\.(ai|io|dev|tech|co)\/?\s*$/)) {
      resourceType = 'company';
      typeConfidence = 0.4;
    } else {
      // Generic article fallback is better than "other-webpage"
      resourceType = 'article';
      typeConfidence = 0.35;
    }
  }

  // 2. Score research areas
  const areaScores = {};
  for (const [area, keywords] of Object.entries(vocabulary.conceptToArea)) {
    let score = 0;

    // Enrichment research_areas match (highest weight)
    if (enrichedAreas.includes(area)) score += 0.8;

    // Key concepts → area mapping
    for (const concept of keyConcepts) {
      if (keywords.some(kw => concept.includes(kw) || kw.includes(concept))) {
        score += 0.6;
        break; // one match per area from concepts
      }
    }

    // Technical approaches match
    if (techApproaches.some(t => keywords.some(kw => t.includes(kw)))) {
      score += 0.3;
    }

    // Title/description keyword match
    if (keywords.some(kw => allText.includes(kw))) {
      score += 0.4;
    }

    // GitHub topics match
    if (githubTopics.some(gt => keywords.some(kw => gt.toLowerCase().includes(kw)))) {
      score += 0.7;
    }

    // Normalize to 0-1 range (max possible ~2.8)
    areaScores[area] = Math.min(score / 2.0, 1.0);
  }

  const researchAreas = Object.entries(areaScores)
    .filter(([, score]) => score >= 0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([area]) => area);

  // 3. Score topics via synonym matching
  const topicScores = {};
  for (const [topic, synonyms] of Object.entries(vocabulary.synonyms)) {
    let score = 0;

    // Key concepts match synonyms
    for (const concept of keyConcepts) {
      if (synonyms.some(syn => concept.includes(syn) || syn.includes(concept))) {
        score += 0.7;
        break;
      }
    }

    // GitHub topics match
    if (githubTopics.some(gt => {
      const gtLower = gt.toLowerCase();
      return synonyms.some(syn => gtLower.includes(syn) || syn.includes(gtLower));
    })) {
      score += 0.8;
    }

    // Direct topic name in GitHub topics
    if (githubTopics.some(gt => gt.toLowerCase() === topic)) {
      score += 0.9;
    }

    // Title/description match
    if (synonyms.some(syn => allText.includes(syn))) {
      score += 0.5;
    }

    topicScores[topic] = Math.min(score / 1.8, 1.0);
  }

  const topics = Object.entries(topicScores)
    .filter(([, score]) => score >= 0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic]) => topic);

  // 4. Determine resource subtype
  const resourceSubtype = [];
  const subtypeRules = vocabulary.subtypeRules[resourceType];
  if (subtypeRules) {
    for (const [pattern, subtype] of Object.entries(subtypeRules)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(allText) || regex.test(url)) {
        resourceSubtype.push(subtype);
      }
    }
  }
  // Cap at 2 subtypes
  resourceSubtype.splice(2);

  // 5. Merge classification overrides (from LLM one-time classification)
  const { overrides } = loadConfig();
  const override = overrides[url];
  if (override) {
    if (override.researchAreas) {
      for (const a of override.researchAreas) {
        if (!researchAreas.includes(a)) researchAreas.push(a);
      }
    }
    if (override.topics) {
      for (const t of override.topics) {
        if (!topics.includes(t)) topics.push(t);
      }
    }
    if (override.resourceSubtype) {
      for (const s of override.resourceSubtype) {
        if (!resourceSubtype.includes(s)) resourceSubtype.push(s);
      }
    }
    if (override.resourceType) {
      resourceType = override.resourceType;
      typeConfidence = 0.9;
    }
  }

  // 6. Compute overall confidence
  const areaConfidence = researchAreas.length > 0 ? 0.85 : 0;
  const topicConfidence = topics.length > 0 ? 0.85 : 0;

  const overallConfidence = Math.round(
    (typeConfidence * 0.3 + areaConfidence * 0.35 + topicConfidence * 0.35) * 100
  ) / 100;

  return {
    facets: {
      resourceType,
      resourceSubtype,
      researchAreas,
      topics,
      sourcePlatform
    },
    significance,
    confidence: overallConfidence
  };
}

module.exports = { classifyLink };
