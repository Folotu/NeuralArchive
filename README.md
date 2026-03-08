# Neural Observatory

An AI and robotics research link aggregation platform. Save links from your phone, auto-enrich with metadata, and visualize connections between research threads.

**Live**: [folotu.github.io/NeuralArchive](https://folotu.github.io/NeuralArchive/)

## How it works

```
iOS Share Sheet --> GitHub API --> Enrich Metadata --> Classify --> Build Graph --> Deploy
```

1. Share a URL from your iPhone via iOS Shortcut
2. GitHub Actions enriches the link (title, description, concepts, research areas)
3. Faceted classifier assigns resource type, research areas, and topics
4. Similarity graph is precomputed (weighted edges, clusters, bridge detection)
5. Site deploys automatically to GitHub Pages

## Pages

- **/research** -- Knowledge graph with weighted similarity edges, cluster detection, bridge nodes, timeline strip. Filter by type and research area.
- **/links** -- Faceted browsing with sidebar filters (type, research area, topics, platform). Delete button for curation.

## Pipeline

| Script | Purpose |
|---|---|
| `enrichLinksIntelligent.js` | Fetch URLs, extract metadata, detect concepts |
| `findDupes.js` | Remove duplicate entries (keep oldest) |
| `processLinks.js` | Classify links with faceted taxonomy, generate `categorized_links.json` |
| `buildGraph.js` | Compute IDF-weighted similarity, clusters, bridges, layout |
| `deleteLinks.js` | Permanently remove links from `messages.json` |

## Classification

Links get multi-label facets instead of a single category:

- **resourceType** (single): paper, repository, article, thread, video, demo, company, job, documentation, tool
- **researchAreas** (multi): manipulation, locomotion, embodied-ai, perception, control, robot-learning, sim-to-real, generative-ai, etc.
- **topics** (multi): dexterous-manipulation, humanoids, reinforcement-learning, vla, mujoco, ros2, foundation-models, etc.
- **sourcePlatform** (single): arxiv, github, huggingface, youtube, x-twitter, etc.

Taxonomy and vocabulary are in `scripts/taxonomy.json` and `scripts/vocabulary.json`.

## Run locally

```bash
cd observatory
npm install
npm start
```

Process links:

```bash
node scripts/processLinks.js
node scripts/buildGraph.js
```

## iOS Shortcut

The `togithub.shortcut` file contains the ScPL source for the iOS Shortcut. It appends URLs to `raw_links.txt` via the GitHub Contents API. You need to replace `REPLACE_WITH_PAT` with your GitHub Personal Access Token.

## Tech

- React 17, Docusaurus 2
- React Flow 11 (graph visualization)
- Recharts 2 (timeline strip)
- Framer Motion 6 (animations)
- GitHub Actions (CI/CD)
- GitHub Pages (hosting)
