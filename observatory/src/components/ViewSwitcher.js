import React from 'react';
import { motion } from 'framer-motion';
import styles from './ViewSwitcher.module.css';

const views = [
  { id: 'graph', label: 'Graph', icon: '🕸️', description: 'Knowledge Network' },
  { id: 'timeline', label: 'Timeline', icon: '📈', description: 'Chronological' },
  { id: 'clusters', label: 'Clusters', icon: '🎯', description: 'AI-Grouped' },
];

const ViewSwitcher = ({ currentView, onViewChange }) => {
  return (
    <div className={styles.container}>
      <div className={styles.viewTabs}>
        {views.map((view) => {
          const isActive = currentView === view.id;

          return (
            <motion.button
              key={view.id}
              className={`${styles.viewTab} ${isActive ? styles.viewTabActive : ''}`}
              onClick={() => onViewChange(view.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className={styles.viewIcon}>{view.icon}</span>
              <div className={styles.viewInfo}>
                <span className={styles.viewLabel}>{view.label}</span>
                <span className={styles.viewDescription}>{view.description}</span>
              </div>

              {isActive && (
                <motion.div
                  className={styles.activeIndicator}
                  layoutId="activeView"
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Neural Connection Lines */}
      <div className={styles.neuralLines}>
        <svg className={styles.neuralSvg} viewBox="0 0 100 2">
          <motion.line
            x1="0"
            y1="1"
            x2="100"
            y2="1"
            stroke="var(--color-accent-blue)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.3 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
        </svg>
      </div>
    </div>
  );
};

export default ViewSwitcher;
