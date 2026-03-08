import React, { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import styles from './TimeStrip.module.css';

// Map clusters to lane numbers for Y axis
function buildClusterLanes(clusters) {
  const lanes = {};
  (clusters || []).forEach((c, i) => {
    lanes[c.id] = i;
  });
  lanes['cluster_isolated'] = (clusters || []).length;
  return lanes;
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div style={{
        background: '#1e1e1e',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: '0.75rem',
        color: '#e8e6e3',
        maxWidth: 250
      }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.title}</div>
        <div style={{ color: 'rgba(235,235,245,0.5)', fontSize: '0.65rem' }}>
          {d.resourceType} &middot; {d.clusterLabel}
        </div>
      </div>
    );
  }
  return null;
}

export default function TimeStrip({ graphData, selectedNodeId, onNodeSelect }) {
  const clusterLanes = useMemo(() =>
    buildClusterLanes(graphData?.clusters),
    [graphData]
  );

  const data = useMemo(() => {
    return (graphData?.nodes || []).map(node => {
      const d = node.data;
      const ts = new Date(d.timestamp).getTime();
      const lane = clusterLanes[d.clusterId] !== undefined
        ? clusterLanes[d.clusterId] : Object.keys(clusterLanes).length;
      const cluster = (graphData?.clusters || []).find(c => c.id === d.clusterId);

      return {
        id: node.id,
        x: ts,
        y: lane,
        title: d.title,
        resourceType: d.resourceType,
        color: d.color,
        significance: d.significance,
        size: d.significance === 'high' ? 8 : d.significance === 'medium' ? 5 : 3,
        clusterId: d.clusterId,
        clusterLabel: cluster ? cluster.label : 'Isolated',
        isSelected: node.id === selectedNodeId,
        bridgeScore: d.bridgeScore
      };
    }).filter(d => !isNaN(d.x));
  }, [graphData, clusterLanes, selectedNodeId]);

  const handleClick = (entry) => {
    if (onNodeSelect && entry) {
      onNodeSelect(entry.id);
    }
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.label}>Timeline</div>
      <ResponsiveContainer width="100%" height={90}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: 'rgba(235,235,245,0.3)' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            dataKey="y"
            type="number"
            hide
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Scatter data={data} onClick={handleClick}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isSelected ? '#0066FF' : entry.color}
                r={entry.isSelected ? 10 : entry.size}
                stroke={entry.isSelected ? '#fff' : entry.bridgeScore > 0.3 ? '#FF9500' : 'none'}
                strokeWidth={entry.isSelected ? 2 : entry.bridgeScore > 0.3 ? 1 : 0}
                opacity={entry.isSelected ? 1 : 0.7}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
