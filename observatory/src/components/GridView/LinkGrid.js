import React from 'react';
import { motion } from 'framer-motion';
import LinkCard from '../LinkCard/LinkCard';
import styles from './LinkGrid.module.css';

const LinkGrid = ({ links, onGraphView }) => {
  // Sort links by timestamp (newest first)
  const sortedLinks = React.useMemo(() => {
    return [...links].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB - dateA; // Descending order (newest first)
    });
  }, [links]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
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

  if (!links || links.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🔍</div>
        <h2 className={styles.emptyTitle}>No research found</h2>
        <p className={styles.emptyText}>
          Try adjusting your filters or search query
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className={styles.grid}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {sortedLinks.map((link) => (
        <motion.div
          key={link.id}
          variants={itemVariants}
        >
          <LinkCard
            link={link}
            onGraphView={onGraphView}
            variant="full"
          />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default LinkGrid;
