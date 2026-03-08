import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LinkCard from '../LinkCard/LinkCard';
import styles from './Clusters.module.css';

const Clusters = ({ links, clusters }) => {
  const [expandedCluster, setExpandedCluster] = React.useState(null);

  // Group links by cluster
  const groupedLinks = React.useMemo(() => {
    const groups = {};
    clusters.forEach((cluster) => {
      groups[cluster.id] = {
        cluster,
        links: links.filter((link) => cluster.linkIds.includes(link.id))
      };
    });
    return groups;
  }, [links, clusters]);

  const toggleCluster = (clusterId) => {
    setExpandedCluster(expandedCluster === clusterId ? null : clusterId);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const clusterVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 25
      }
    }
  };

  return (
    <motion.div
      className={styles.clustersGrid}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {Object.entries(groupedLinks).map(([clusterId, { cluster, links: clusterLinks }]) => {
        const isExpanded = expandedCluster === clusterId;

        return (
          <motion.div
            key={clusterId}
            className={styles.clusterCard}
            variants={clusterVariants}
          >
            {/* Cluster Header */}
            <motion.div
              className={styles.clusterHeader}
              onClick={() => toggleCluster(clusterId)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={styles.clusterInfo}>
                <h3 className={styles.clusterName}>{cluster.name}</h3>
                <div className={styles.clusterMeta}>
                  <span className={styles.clusterCount}>
                    {clusterLinks.length} {clusterLinks.length === 1 ? 'link' : 'links'}
                  </span>
                  <div className={styles.clusterTopics}>
                    {cluster.topics.slice(0, 3).map((topic, index) => (
                      <span key={index} className={styles.clusterTopic}>
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <motion.div
                className={styles.expandIcon}
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                ▼
              </motion.div>
            </motion.div>

            {/* Cluster Preview (Collapsed) */}
            {!isExpanded && (
              <div className={styles.clusterPreview}>
                {clusterLinks.slice(0, 4).map((link) => (
                  <div key={link.id} className={styles.previewItem}>
                    <div className={styles.previewDot} />
                    <span className={styles.previewTitle}>{link.title}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cluster Content (Expanded) */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  className={styles.clusterContent}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className={styles.clusterLinks}>
                    {clusterLinks.map((link) => (
                      <LinkCard key={link.id} link={link} variant="compact" />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default Clusters;
