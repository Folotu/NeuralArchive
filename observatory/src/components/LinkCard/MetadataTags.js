import React from 'react';
import { motion } from 'framer-motion';
import styles from './MetadataTags.module.css';

const MetadataTags = ({ topics = [], technologies = [], author, maxDisplay = 5 }) => {
  const displayTopics = topics.slice(0, Math.min(maxDisplay, topics.length));
  const displayTech = technologies.slice(0, Math.min(maxDisplay - displayTopics.length, technologies.length));
  const hasMore = (topics.length + technologies.length) > maxDisplay;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24
      }
    }
  };

  return (
    <motion.div
      className={styles.container}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Author Badge */}
      {author && (
        <motion.div
          className={styles.authorBadge}
          variants={itemVariants}
        >
          {author.avatar && (
            <img
              src={author.avatar}
              alt={author.name}
              className={styles.authorAvatar}
            />
          )}
          <span className={styles.authorHandle}>{author.handle}</span>
          {author.affiliation && (
            <span className={styles.authorAffiliation}>· {author.affiliation}</span>
          )}
        </motion.div>
      )}

      {/* Topics */}
      {displayTopics.map((topic, index) => (
        <motion.span
          key={`topic-${index}`}
          className={`${styles.tag} ${styles.topicTag}`}
          variants={itemVariants}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className={styles.tagIcon}>◆</span>
          {topic}
        </motion.span>
      ))}

      {/* Technologies */}
      {displayTech.map((tech, index) => (
        <motion.span
          key={`tech-${index}`}
          className={`${styles.tag} ${styles.techTag}`}
          variants={itemVariants}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className={styles.tagIcon}>▸</span>
          {tech}
        </motion.span>
      ))}

      {/* More Indicator */}
      {hasMore && (
        <motion.span
          className={styles.moreIndicator}
          variants={itemVariants}
        >
          +{(topics.length + technologies.length) - maxDisplay} more
        </motion.span>
      )}
    </motion.div>
  );
};

export default MetadataTags;
