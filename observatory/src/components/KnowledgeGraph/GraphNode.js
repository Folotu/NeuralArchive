import React from 'react';
import { Handle, Position } from 'reactflow';
import styles from './GraphNode.module.css';

// Content type display configuration (matches GraphView.js)
const CONTENT_TYPE_CONFIG = {
  'research-paper': { color: '#34C759', icon: '📄' },
  'research-blog': { color: '#30D158', icon: '🔬' },
  'github-project': { color: '#0066FF', icon: '💻' },
  'github-tool': { color: '#0A84FF', icon: '🛠️' },
  'documentation': { color: '#5E5CE6', icon: '📚' },
  'company-website': { color: '#FF9F0A', icon: '🏢' },
  'startup-profile': { color: '#FFB340', icon: '🚀' },
  'job-posting': { color: '#FF375F', icon: '💼' },
  'internship': { color: '#FF6482', icon: '🎓' },
  'tutorial': { color: '#BF5AF2', icon: '📖' },
  'video-tutorial': { color: '#DA8FFF', icon: '🎥' },
  'video': { color: '#AC8E68', icon: '▶️' },
  'coding-practice': { color: '#8E7CC3', icon: '⚡' },
  'twitter': { color: '#32ADE6', icon: '🐦' },
  'linkedin': { color: '#0A66C2', icon: '💼' },
  'document': { color: '#98989D', icon: '📝' },
  'spreadsheet': { color: '#8E8E93', icon: '📊' },
  'ai-tool': { color: '#FF2D55', icon: '🤖' },
  'other': { color: '#636366', icon: '📌' },
};

const GraphNode = ({ data }) => {
  const { label, contentType, metrics, topics } = data;

  const getNodeColor = () => {
    const config = CONTENT_TYPE_CONFIG[contentType];
    return config ? config.color : '#636366';
  };

  const getContentIcon = () => {
    const config = CONTENT_TYPE_CONFIG[contentType];
    return config ? config.icon : '🔗';
  };

  const getMetricValue = () => {
    if (!metrics) return null;
    if (metrics.stars) return metrics.stars;
    if (metrics.likes) return metrics.likes;
    return null;
  };

  const metricValue = getMetricValue();

  return (
    <div
      className={styles.node}
      style={{
        borderColor: getNodeColor(),
        boxShadow: `0 0 20px ${getNodeColor()}40`,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={styles.handle}
      />

      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>{getContentIcon()}</span>
        {metricValue && (
          <span className={styles.nodeMetric}>
            {metricValue > 1000 ? `${(metricValue / 1000).toFixed(1)}k` : metricValue}
          </span>
        )}
      </div>

      <div className={styles.nodeContent}>
        <div className={styles.nodeLabel}>{label}</div>
        {topics && topics.length > 0 && (
          <div className={styles.nodeTopics}>
            {topics.slice(0, 2).map((topic, index) => (
              <span key={index} className={styles.nodeTopic}>
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={styles.handle}
      />
    </div>
  );
};

export default GraphNode;
