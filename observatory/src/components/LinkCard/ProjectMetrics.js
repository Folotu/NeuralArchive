import React from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import styles from './ProjectMetrics.module.css';

const AnimatedNumber = ({ value, suffix = '' }) => {
  const [displayValue, setDisplayValue] = React.useState(0);
  const spring = useSpring(0, { stiffness: 200, damping: 30 });

  React.useEffect(() => {
    spring.set(value);
    const unsubscribe = spring.onChange((latest) => {
      setDisplayValue(Math.round(latest));
    });
    return unsubscribe;
  }, [spring, value]);

  return (
    <>
      <span>{displayValue.toLocaleString()}</span>
      {suffix}
    </>
  );
};

const ProjectMetrics = ({ metrics, contentType }) => {
  if (!metrics) return null;

  const { stars, forks, issues, likes, views } = metrics;
  const isGitHub = contentType === 'github';
  const isSocial = contentType === 'tweet' || contentType === 'video';

  return (
    <div className={styles.metricsContainer}>
      {/* GitHub Metrics */}
      {isGitHub && stars > 0 && (
        <motion.div
          className={styles.metric}
          whileHover={{ scale: 1.05, y: -2 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span className={styles.metricIcon}>⭐</span>
          <AnimatedNumber value={stars} />
          <span className={styles.metricLabel}>stars</span>
        </motion.div>
      )}

      {isGitHub && forks > 0 && (
        <motion.div
          className={styles.metric}
          whileHover={{ scale: 1.05, y: -2 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className={styles.metricIcon}>🔀</span>
          <AnimatedNumber value={forks} />
          <span className={styles.metricLabel}>forks</span>
        </motion.div>
      )}

      {isGitHub && issues > 0 && (
        <motion.div
          className={`${styles.metric} ${issues > 50 ? styles.metricWarning : ''}`}
          whileHover={{ scale: 1.05, y: -2 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <span className={styles.metricIcon}>⚠️</span>
          <AnimatedNumber value={issues} />
          <span className={styles.metricLabel}>issues</span>
        </motion.div>
      )}

      {/* Social Metrics */}
      {isSocial && likes > 0 && (
        <motion.div
          className={styles.metric}
          whileHover={{ scale: 1.05, y: -2 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span className={styles.metricIcon}>❤️</span>
          <AnimatedNumber value={likes} />
          <span className={styles.metricLabel}>likes</span>
        </motion.div>
      )}

      {isSocial && views > 0 && (
        <motion.div
          className={styles.metric}
          whileHover={{ scale: 1.05, y: -2 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className={styles.metricIcon}>👁️</span>
          <AnimatedNumber value={views} />
          <span className={styles.metricLabel}>views</span>
        </motion.div>
      )}
    </div>
  );
};

export default ProjectMetrics;
