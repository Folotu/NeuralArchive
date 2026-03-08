import React from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import LinkCard from '../LinkCard/LinkCard';
import styles from './Timeline.module.css';

const Timeline = ({ links }) => {
  // Group links by month and sort within each group
  const groupedLinks = React.useMemo(() => {
    const groups = {};
    links.forEach((link) => {
      if (!link.timestamp) return;
      try {
        const date = parseISO(link.timestamp);
        const monthKey = format(date, 'MMMM yyyy');
        if (!groups[monthKey]) {
          groups[monthKey] = [];
        }
        groups[monthKey].push(link);
      } catch (e) {
        console.error('Error parsing timestamp:', e);
      }
    });

    // Sort links within each month (newest first)
    Object.keys(groups).forEach(monthKey => {
      groups[monthKey].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    });

    return groups;
  }, [links]);

  const sortedMonths = Object.keys(groupedLinks).sort((a, b) => {
    return new Date(b) - new Date(a); // Most recent first
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 25
      }
    }
  };

  if (links.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📈</div>
        <h2 className={styles.emptyTitle}>No timeline data</h2>
        <p className={styles.emptyText}>
          Add timestamps to your links to see them on the timeline
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className={styles.timeline}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {sortedMonths.map((month) => (
        <motion.div
          key={month}
          className={styles.timelineSection}
          variants={itemVariants}
        >
          <div className={styles.monthDivider}>
            <div className={styles.monthLine} />
            <div className={styles.monthLabel}>
              <span className={styles.monthIcon}>📅</span>
              {month}
              <span className={styles.monthCount}>
                {groupedLinks[month].length} {groupedLinks[month].length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className={styles.monthLine} />
          </div>

          <div className={styles.timelineCards}>
            {groupedLinks[month].map((link) => (
              <motion.div
                key={link.id}
                variants={itemVariants}
              >
                <LinkCard link={link} variant="timeline" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default Timeline;
