import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ViewSwitcher from '../components/ViewSwitcher';
import GraphView from '../components/KnowledgeGraph/GraphView';
import TimeStrip from '../components/TimeStrip/TimeStrip';
import Timeline from '../components/TimelineView/Timeline';
import Clusters from '../components/ClusterView/Clusters';
import categorizedLinksData from '../categorized_links.json';
import researchGraphData from '../research-graph.json';
import styles from './research.module.css';

// Flatten data into array format (supports both old and new JSON shapes)
const rawLinks = Array.isArray(categorizedLinksData.links)
  ? categorizedLinksData.links
  : Object.values(categorizedLinksData).flat();

const categorizedLinks = rawLinks.map((link, index) => {
  const facets = link.facets || {};
  const topics = facets.topics || link.topics || [];
  const researchAreas = facets.researchAreas || [];
  const clusterSource = researchAreas.length > 0 ? researchAreas[0] : (topics.length > 0 ? topics[0] : 'other');

  return {
    id: String(index + 1),
    url: link.link || link.url,
    title: link.title,
    description: link.description || link.content,
    author: link.author,
    topics: topics,
    technologies: researchAreas,
    contentType: facets.resourceType || link.contentType,
    metrics: link.metrics || { stars: 0, forks: 0, likes: 0, views: 0 },
    timestamp: link.timestamp,
    clusterId: `cluster_${clusterSource}`,
    content: link.content
  };
});

// Generate clusters from the categorized links
const generateClusters = (links) => {
  const clusterMap = {};

  links.forEach(link => {
    const clusterId = link.clusterId || 'cluster_other';
    if (!clusterMap[clusterId]) {
      clusterMap[clusterId] = {
        id: clusterId,
        name: clusterId.replace('cluster_', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        linkIds: [],
        topics: new Set(),
        dominantTech: new Set(),
        centerEmbedding: [0, 0, 0]
      };
    }

    clusterMap[clusterId].linkIds.push(link.id);
    (link.topics || []).forEach(topic => clusterMap[clusterId].topics.add(topic));
    (link.technologies || []).forEach(tech => clusterMap[clusterId].dominantTech.add(tech));
  });

  return Object.values(clusterMap).map(cluster => ({
    ...cluster,
    topics: Array.from(cluster.topics),
    dominantTech: Array.from(cluster.dominantTech)
  }));
};

const mockClusters = generateClusters(categorizedLinks);

export default function ResearchPlatform() {
  const [currentView, setCurrentView] = React.useState('graph');
  const [selectedNode, setSelectedNode] = React.useState(null);

  // Force dark mode on mount
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.classList.add('research-page');
    document.body.style.backgroundColor = '#181a1b';

    // Force dark background on all parent elements
    const docusaurusRoot = document.getElementById('__docusaurus');
    if (docusaurusRoot) {
      docusaurusRoot.style.backgroundColor = '#181a1b';
    }

    return () => {
      document.body.classList.remove('research-page');
    };
  }, []);

  const handleViewChange = (view) => {
    setCurrentView(view);
    setSelectedNode(null);
  };

  const handleNodeClick = (link) => {
    setSelectedNode(link);
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  return (
    <div className={styles.researchPlatform}>
      <div className={styles.container}>
        {/* Header */}
        <motion.header
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.headerContent}>
            <h1 className={styles.title}>
              <span className={styles.titleIcon}>🧬</span>
              Neural Observatory
              <span className={styles.titleSubtext}>Research Intelligence Platform</span>
            </h1>
            <p className={styles.subtitle}>
              Visualize connections, discover patterns, and synthesize insights from robotics & AI research
            </p>
          </div>

          {/* Stats Bar */}
          <div className={styles.statsBar}>
            <div
              className={styles.statItem}
              onClick={() => handleViewChange('graph')}
              title="View knowledge graph"
            >
              <span className={styles.statValue}>{categorizedLinks.length}</span>
              <span className={styles.statLabel}>Research Items</span>
            </div>
            <div className={styles.statDivider} />
            <div
              className={styles.statItem}
              onClick={() => handleViewChange('clusters')}
              title="View research clusters"
            >
              <span className={styles.statValue}>{mockClusters.length}</span>
              <span className={styles.statLabel}>Clusters</span>
            </div>
            <div className={styles.statDivider} />
            <div
              className={styles.statItem}
              onClick={() => handleViewChange('timeline')}
              title="View research topics over time"
            >
              <span className={styles.statValue}>
                {new Set(categorizedLinks.flatMap(l => l.topics || [])).size}
              </span>
              <span className={styles.statLabel}>Topics</span>
            </div>
            <div className={styles.statDivider} />
            <a
              className={styles.statItem}
              href="/NeuralArchive/links"
              title="Browse and filter all links"
              style={{ textDecoration: 'none' }}
            >
              <span className={styles.statValue}>Browse</span>
              <span className={styles.statLabel}>All Links</span>
            </a>
          </div>
        </motion.header>

        {/* View Switcher */}
        <ViewSwitcher currentView={currentView} onViewChange={handleViewChange} />

        {/* View Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            className={styles.viewContent}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            {currentView === 'graph' && (
              <>
                <GraphView
                  graphData={researchGraphData}
                  onNodeClick={handleNodeClick}
                />
                <TimeStrip
                  graphData={researchGraphData}
                  selectedNodeId={selectedNode?.id}
                  onNodeSelect={(id) => {
                    const node = researchGraphData.nodes.find(n => n.id === id);
                    if (node) handleNodeClick(node.data);
                  }}
                />
              </>
            )}

            {currentView === 'timeline' && (
              <Timeline links={categorizedLinks} />
            )}

            {currentView === 'clusters' && (
              <Clusters
                links={categorizedLinks}
                clusters={mockClusters}
              />
            )}

          </motion.div>
        </AnimatePresence>

        {/* Selected Node Details */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              className={styles.detailPanel}
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className={styles.detailHeader}>
                <h3 className={styles.detailTitle}>Selected Research</h3>
                <button
                  className={styles.closeButton}
                  onClick={() => setSelectedNode(null)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.detailContent}>
                <a
                  href={selectedNode.url || selectedNode.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.detailLink}
                >
                  {selectedNode.title}
                </a>
                <p className={styles.detailDescription}>
                  {selectedNode.description}
                </p>
                {selectedNode.topics && selectedNode.topics.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                    {selectedNode.topics.map(t => (
                      <span key={t} style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10,
                        background: 'rgba(0,102,255,0.15)', color: '#4d9fff'
                      }}>{t.replace(/-/g, ' ')}</span>
                    ))}
                  </div>
                )}
                {selectedNode.bridgeScore > 0.3 && (
                  <div style={{
                    marginTop: 8, fontSize: '0.75rem', color: '#FF9500',
                    background: 'rgba(255,149,0,0.1)', padding: '4px 8px', borderRadius: 6
                  }}>
                    Bridge node (score: {selectedNode.bridgeScore})
                  </div>
                )}
                {selectedNode.author && (
                  <div className={styles.detailAuthor}>
                    <span>{selectedNode.author.handle}</span>
                    {selectedNode.author.affiliation && (
                      <span> · {selectedNode.author.affiliation}</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
