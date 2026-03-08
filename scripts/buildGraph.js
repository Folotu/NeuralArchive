#!/usr/bin/env node
/**
 * Build a weighted similarity graph from categorized links.
 *
 * Computes:
 * - IDF-weighted topic/area similarity edges
 * - Connected-component clusters
 * - Bridge scores for cross-cluster nodes
 * - Radial cluster layout positions
 *
 * Outputs: observatory/src/research-graph.json
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'observatory', 'src', 'categorized_links.json');
const OUTPUT = path.join(__dirname, '..', 'observatory', 'src', 'research-graph.json');

// Complementary type pairs that deserve a bonus
const CROSS_TYPE_BONUS_PAIRS = new Set([
  'paper-repository', 'repository-paper',
  'paper-thread', 'thread-paper',
  'paper-article', 'article-paper',
  'repository-article', 'article-repository',
  'paper-demo', 'demo-paper',
  'repository-demo', 'demo-repository',
]);

// Content type colors (matches existing GraphView config)
const TYPE_COLORS = {
  paper: '#FF6B6B',
  repository: '#4ECDC4',
  article: '#45B7D1',
  thread: '#96CEB4',
  video: '#DDA0DD',
  demo: '#F7DC6F',
  company: '#BB8FCE',
  job: '#AED6F1',
  documentation: '#82E0AA',
  dataset: '#F0B27A',
  tool: '#D5DBDB',
  'other-webpage': '#AAB7B8',
};

function main() {
  console.log('Building research graph...');
  const data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  const links = data.links || [];
  const N = links.length;
  console.log(`  ${N} links loaded`);

  // 1. Compute document frequency and IDF for topics + areas
  const topicDF = {};
  const areaDF = {};
  for (const link of links) {
    for (const t of (link.facets.topics || [])) {
      topicDF[t] = (topicDF[t] || 0) + 1;
    }
    for (const a of (link.facets.researchAreas || [])) {
      areaDF[a] = (areaDF[a] || 0) + 1;
    }
  }

  const topicIDF = {};
  for (const [t, df] of Object.entries(topicDF)) {
    topicIDF[t] = Math.log((N + 1) / (df + 1)) + 1;
  }
  const areaIDF = {};
  for (const [a, df] of Object.entries(areaDF)) {
    areaIDF[a] = Math.log((N + 1) / (df + 1)) + 1;
  }

  // 2. Compute pairwise edge scores
  console.log('  Computing pairwise similarity...');
  const rawEdges = [];

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const a = links[i];
      const b = links[j];
      const aTopics = a.facets.topics || [];
      const bTopics = b.facets.topics || [];
      const aAreas = a.facets.researchAreas || [];
      const bAreas = b.facets.researchAreas || [];

      // Skip if both have no labels
      if (aTopics.length === 0 && aAreas.length === 0) continue;
      if (bTopics.length === 0 && bAreas.length === 0) continue;

      // Weighted Jaccard for topics
      const topicOverlap = weightedJaccard(aTopics, bTopics, topicIDF);

      // Weighted Jaccard for areas
      const areaOverlap = weightedJaccard(aAreas, bAreas, areaIDF);

      // Subtype affinity
      const aSubtypes = a.facets.resourceSubtype || [];
      const bSubtypes = b.facets.resourceSubtype || [];
      const subtypeBonus = aSubtypes.some(s => bSubtypes.includes(s)) ? 0.1 : 0;

      // Cross-type bonus
      const typeA = a.facets.resourceType;
      const typeB = b.facets.resourceType;
      const crossTypeKey = `${typeA}-${typeB}`;
      const crossTypeBonus = CROSS_TYPE_BONUS_PAIRS.has(crossTypeKey) ? 0.1 : 0;

      // Temporal affinity
      let timeBonus = 0;
      try {
        const dA = new Date(a.timestamp);
        const dB = new Date(b.timestamp);
        const daysBetween = Math.abs(dA - dB) / (1000 * 60 * 60 * 24);
        timeBonus = Math.max(0, 0.05 * (1 - daysBetween / 365));
      } catch {}

      const score = 0.50 * topicOverlap
                  + 0.20 * areaOverlap
                  + 0.10 * subtypeBonus
                  + 0.10 * crossTypeBonus
                  + 0.10 * timeBonus;

      if (score < 0.35) continue;

      // Build reason list
      const reasons = [];
      const sharedTopics = aTopics.filter(t => bTopics.includes(t));
      const sharedAreas = aAreas.filter(a2 => bAreas.includes(a2));
      for (const t of sharedTopics.slice(0, 3)) {
        reasons.push({ kind: 'topic', label: t, weight: topicIDF[t] || 1 });
      }
      for (const a2 of sharedAreas.slice(0, 2)) {
        reasons.push({ kind: 'area', label: a2, weight: areaIDF[a2] || 1 });
      }
      if (crossTypeBonus > 0) {
        reasons.push({ kind: 'crossType', label: `${typeA}-${typeB}`, weight: 0.1 });
      }

      rawEdges.push({
        source: i,
        target: j,
        score: Math.round(score * 100) / 100,
        strength: score >= 0.70 ? 'strong' : score >= 0.50 ? 'medium' : 'weak',
        reasons
      });
    }
  }

  console.log(`  ${rawEdges.length} raw edges above threshold`);

  // 3. Prune to top-K neighbors per node
  const MAX_NEIGHBORS = 8;
  const neighborEdges = new Map(); // nodeIndex -> sorted edge list
  for (const edge of rawEdges) {
    if (!neighborEdges.has(edge.source)) neighborEdges.set(edge.source, []);
    if (!neighborEdges.has(edge.target)) neighborEdges.set(edge.target, []);
    neighborEdges.get(edge.source).push(edge);
    neighborEdges.get(edge.target).push(edge);
  }

  const keptEdgeKeys = new Set();
  for (const [, edges] of neighborEdges) {
    edges.sort((a, b) => b.score - a.score);
    for (const e of edges.slice(0, MAX_NEIGHBORS)) {
      keptEdgeKeys.add(`${Math.min(e.source, e.target)}-${Math.max(e.source, e.target)}`);
    }
  }

  const prunedEdges = rawEdges.filter(e => {
    const key = `${Math.min(e.source, e.target)}-${Math.max(e.source, e.target)}`;
    return keptEdgeKeys.has(key);
  });

  console.log(`  ${prunedEdges.length} edges after top-${MAX_NEIGHBORS} pruning`);

  // 4. Cluster detection via connected components on strong+medium edges
  const clusterEdges = prunedEdges.filter(e => e.strength !== 'weak');
  const parent = Array.from({ length: N }, (_, i) => i);

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (const e of clusterEdges) {
    union(e.source, e.target);
  }

  // Assign cluster IDs
  const clusterMap = {};
  for (let i = 0; i < N; i++) {
    const root = find(i);
    if (!clusterMap[root]) clusterMap[root] = [];
    clusterMap[root].push(i);
  }

  // Sort clusters by size, assign sequential IDs
  const clusterGroups = Object.values(clusterMap).sort((a, b) => b.length - a.length);
  const nodeCluster = new Array(N).fill('cluster_isolated');

  const clusters = [];
  let clusterIdx = 0;
  for (const group of clusterGroups) {
    if (group.length < 2) {
      // Single nodes stay as isolated
      continue;
    }
    const cid = `cluster_${clusterIdx}`;
    clusterIdx++;

    // Find top terms
    const termCounts = {};
    for (const ni of group) {
      for (const t of (links[ni].facets.topics || [])) {
        termCounts[t] = (termCounts[t] || 0) + 1;
      }
      for (const a of (links[ni].facets.researchAreas || [])) {
        termCounts[a] = (termCounts[a] || 0) + 1;
      }
    }
    const topTerms = Object.entries(termCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    // Label from top terms
    const label = topTerms.map(t =>
      t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    ).join(' / ');

    for (const ni of group) {
      nodeCluster[ni] = cid;
    }

    clusters.push({
      id: cid,
      label,
      topTerms,
      nodeIds: group.map(i => `link_${i}`),
      size: group.length
    });
  }

  console.log(`  ${clusters.length} clusters detected`);

  // 5. Bridge detection
  const bridgeScores = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const myCluster = nodeCluster[i];
    const connectedClusters = new Set();
    const crossScores = [];

    for (const e of (neighborEdges.get(i) || [])) {
      const other = e.source === i ? e.target : e.source;
      const otherCluster = nodeCluster[other];
      if (otherCluster !== myCluster && otherCluster !== 'cluster_isolated') {
        connectedClusters.add(otherCluster);
        crossScores.push(e.score);
      }
    }

    if (connectedClusters.size >= 2) {
      const avgCrossScore = crossScores.reduce((s, v) => s + v, 0) / crossScores.length;
      bridgeScores[i] = Math.round(
        (connectedClusters.size / Math.max(clusters.length, 1)) * avgCrossScore * 100
      ) / 100;
    }
  }

  const bridgeCount = bridgeScores.filter(s => s > 0).length;
  console.log(`  ${bridgeCount} bridge nodes detected`);

  // 6. Radial cluster layout
  const RADIUS_BASE = 300;
  const CLUSTER_SPACING = 2 * Math.PI;
  const positions = new Array(N);

  // Give each cluster a sector
  const totalClusters = clusters.length + 1; // +1 for isolated
  let sectorIdx = 0;

  for (const cluster of clusters) {
    const angle = (sectorIdx / totalClusters) * CLUSTER_SPACING;
    const cx = Math.cos(angle) * RADIUS_BASE * 1.5;
    const cy = Math.sin(angle) * RADIUS_BASE * 1.5;
    cluster.center = { x: cx, y: cy };

    const nodeIndices = cluster.nodeIds.map(id => parseInt(id.replace('link_', '')));
    const subRadius = Math.max(80, Math.sqrt(nodeIndices.length) * 50);

    for (let j = 0; j < nodeIndices.length; j++) {
      const subAngle = (j / nodeIndices.length) * 2 * Math.PI;
      positions[nodeIndices[j]] = {
        x: Math.round(cx + Math.cos(subAngle) * subRadius),
        y: Math.round(cy + Math.sin(subAngle) * subRadius)
      };
    }
    sectorIdx++;
  }

  // Position isolated nodes in a ring around the outside
  const isolatedAngle = (sectorIdx / totalClusters) * CLUSTER_SPACING;
  const isolatedNodes = [];
  for (let i = 0; i < N; i++) {
    if (!positions[i]) isolatedNodes.push(i);
  }
  const isoRadius = RADIUS_BASE * 2.5;
  for (let j = 0; j < isolatedNodes.length; j++) {
    const a = isolatedAngle + (j / Math.max(isolatedNodes.length, 1)) * (Math.PI * 0.8);
    positions[isolatedNodes[j]] = {
      x: Math.round(Math.cos(a) * isoRadius),
      y: Math.round(Math.sin(a) * isoRadius)
    };
  }

  // 7. Build output
  const nodes = links.map((link, i) => ({
    id: `link_${i}`,
    type: 'researchNode',
    position: positions[i] || { x: 0, y: 0 },
    data: {
      url: link.link,
      title: link.title,
      description: (link.description || '').slice(0, 120),
      resourceType: link.facets.resourceType,
      topics: (link.facets.topics || []).slice(0, 4),
      researchAreas: link.facets.researchAreas || [],
      sourcePlatform: link.facets.sourcePlatform,
      clusterId: nodeCluster[i],
      bridgeScore: bridgeScores[i],
      significance: link.significance || 'exploratory',
      timestamp: link.timestamp,
      color: TYPE_COLORS[link.facets.resourceType] || '#AAB7B8'
    }
  }));

  const edges = prunedEdges.map((e, i) => ({
    id: `edge_${i}`,
    source: `link_${e.source}`,
    target: `link_${e.target}`,
    type: 'default',
    data: {
      score: e.score,
      strength: e.strength,
      reasons: e.reasons.slice(0, 3),
      isCrossCluster: nodeCluster[e.source] !== nodeCluster[e.target]
    },
    style: {
      stroke: nodeCluster[e.source] !== nodeCluster[e.target] ? '#FF9500' : '#0066FF',
      strokeWidth: e.strength === 'strong' ? 3 : e.strength === 'medium' ? 2 : 1,
      opacity: e.strength === 'strong' ? 0.8 : e.strength === 'medium' ? 0.5 : 0.25
    }
  }));

  // Build topic stats
  const topicStats = {};
  for (const [t, df] of Object.entries(topicDF)) {
    topicStats[t] = { df, idf: Math.round(topicIDF[t] * 100) / 100 };
  }

  const output = { nodes, edges, clusters, topicStats };

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\n  Wrote ${OUTPUT}`);
  console.log(`  ${nodes.length} nodes, ${edges.length} edges, ${clusters.length} clusters`);
  console.log(`  Top clusters:`);
  for (const c of clusters.slice(0, 5)) {
    console.log(`    ${c.label} (${c.size} nodes)`);
  }
}

function weightedJaccard(setA, setB, idfMap) {
  if (setA.length === 0 || setB.length === 0) return 0;
  const a = new Set(setA);
  const b = new Set(setB);
  let intersectionWeight = 0;
  let unionWeight = 0;

  const all = new Set([...a, ...b]);
  for (const item of all) {
    const w = idfMap[item] || 1;
    if (a.has(item) && b.has(item)) {
      intersectionWeight += w;
    }
    unionWeight += w;
  }

  return unionWeight > 0 ? intersectionWeight / unionWeight : 0;
}

main();
