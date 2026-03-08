import React from 'react';
import { Handle, Position } from 'reactflow';
import styles from './ResearchNode.module.css';

function ResearchNode({ data, selected }) {
  const {
    title, resourceType, topics, bridgeScore,
    significance, color, dimmed, highlighted
  } = data;

  const nodeClasses = [
    styles.node,
    dimmed ? styles.dimmed : '',
    highlighted ? styles.highlighted : '',
    selected ? styles.selected : '',
    bridgeScore > 0.3 && !dimmed ? styles.bridgeRing : ''
  ].filter(Boolean).join(' ');

  const sigClass = significance === 'high' ? styles.sigHigh
    : significance === 'medium' ? styles.sigMedium
    : styles.sigExploratory;

  return (
    <div className={nodeClasses} style={{ borderColor: dimmed ? undefined : (highlighted || selected ? '#0066FF' : color + '60') }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />

      <div className={sigClass + ' ' + styles.sigDot} />

      <div className={styles.header}>
        <div className={styles.typeDot} style={{ background: color }} />
        <span className={styles.typeLabel}>{resourceType}</span>
        {bridgeScore > 0.3 && <span className={styles.bridgeBadge}>bridge</span>}
      </div>

      <div className={styles.title} title={title}>{title}</div>

      {topics && topics.length > 0 && (
        <div className={styles.topics}>
          {topics.slice(0, 2).map(t => (
            <span key={t} className={styles.topicChip}>
              {t.replace(/-/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
    </div>
  );
}

export default React.memo(ResearchNode);
