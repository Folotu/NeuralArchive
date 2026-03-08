import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ResearchNode from './ResearchNode';
import styles from './GraphView.module.css';

const nodeTypes = { researchNode: ResearchNode };

export default function GraphView({ graphData, onNodeClick }) {
  const [minStrength, setMinStrength] = useState(0.45);
  const [showBridges, setShowBridges] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterArea, setFilterArea] = useState('all');

  // Build available filter options from data
  const filterOptions = useMemo(() => {
    const types = new Set();
    const areas = new Set();
    for (const node of (graphData?.nodes || [])) {
      types.add(node.data.resourceType);
      for (const a of (node.data.researchAreas || [])) {
        areas.add(a);
      }
    }
    return {
      types: [...types].sort(),
      areas: [...areas].sort()
    };
  }, [graphData]);

  // Build adjacency for quick neighbor lookups
  const adjacency = useMemo(() => {
    const adj = {};
    for (const edge of (graphData?.edges || [])) {
      if (!adj[edge.source]) adj[edge.source] = [];
      if (!adj[edge.target]) adj[edge.target] = [];
      adj[edge.source].push({ neighbor: edge.target, edge });
      adj[edge.target].push({ neighbor: edge.source, edge });
    }
    return adj;
  }, [graphData]);

  // Get neighbors of a node (1-hop)
  const getNeighborIds = useCallback((nodeId) => {
    if (!nodeId) return new Set();
    const neighbors = new Set([nodeId]);
    for (const { neighbor } of (adjacency[nodeId] || [])) {
      neighbors.add(neighbor);
    }
    return neighbors;
  }, [adjacency]);

  // Active highlight set (either from focus or hover)
  const activeNodeId = focusedNodeId || hoveredNodeId;
  const highlightedNodes = useMemo(() => {
    return getNeighborIds(activeNodeId);
  }, [activeNodeId, getNeighborIds]);

  const hasHighlight = activeNodeId !== null;

  // Filter edges by strength threshold
  const visibleEdges = useMemo(() => {
    return (graphData?.edges || []).filter(edge => {
      const score = edge.data?.score || 0;
      return score >= minStrength;
    }).map(edge => {
      const isDimmed = hasHighlight &&
        !highlightedNodes.has(edge.source) &&
        !highlightedNodes.has(edge.target);
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: isDimmed ? 0.04 : (edge.style?.opacity || 0.5),
        }
      };
    });
  }, [graphData, minStrength, hasHighlight, highlightedNodes]);

  // Set of node IDs that pass the filter
  const filteredNodeIds = useMemo(() => {
    const ids = new Set();
    for (const node of (graphData?.nodes || [])) {
      const d = node.data;
      if (filterType !== 'all' && d.resourceType !== filterType) continue;
      if (filterArea !== 'all' && !(d.researchAreas || []).includes(filterArea)) continue;
      ids.add(node.id);
    }
    return ids;
  }, [graphData, filterType, filterArea]);

  const hasFilter = filterType !== 'all' || filterArea !== 'all';

  // Decorate nodes with dimmed/highlighted/filtered state
  const visibleNodes = useMemo(() => {
    return (graphData?.nodes || []).map(node => {
      const passesFilter = filteredNodeIds.has(node.id);
      const isDimmedByHighlight = hasHighlight && !highlightedNodes.has(node.id);
      const isDimmedByFilter = hasFilter && !passesFilter;
      return {
        ...node,
        data: {
          ...node.data,
          dimmed: isDimmedByHighlight || isDimmedByFilter,
          highlighted: hasHighlight && highlightedNodes.has(node.id) && node.id !== activeNodeId,
        }
      };
    });
  }, [graphData, hasHighlight, highlightedNodes, activeNodeId, filteredNodeIds, hasFilter]);

  const [nodes, setNodes, onNodesChange] = useNodesState(visibleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges);

  // Sync when visibleNodes/visibleEdges change
  React.useEffect(() => { setNodes(visibleNodes); }, [visibleNodes, setNodes]);
  React.useEffect(() => { setEdges(visibleEdges); }, [visibleEdges, setEdges]);

  const handleNodeClick = useCallback((event, node) => {
    if (focusedNodeId === node.id) {
      setFocusedNodeId(null);
    } else {
      setFocusedNodeId(node.id);
    }
    if (onNodeClick) {
      onNodeClick(node.data);
    }
  }, [focusedNodeId, onNodeClick]);

  const handlePaneClick = useCallback(() => {
    setFocusedNodeId(null);
    setHoveredNodeId(null);
  }, []);

  const handleNodeMouseEnter = useCallback((event, node) => {
    if (!focusedNodeId) {
      setHoveredNodeId(node.id);
    }
  }, [focusedNodeId]);

  const handleNodeMouseLeave = useCallback(() => {
    if (!focusedNodeId) {
      setHoveredNodeId(null);
    }
  }, [focusedNodeId]);

  // Stats
  const clusterCount = graphData?.clusters?.length || 0;
  const bridgeCount = (graphData?.nodes || []).filter(n => n.data.bridgeScore > 0.3).length;
  const edgeCount = visibleEdges.length;

  return (
    <div className={styles.container}>
      <div className={styles.graphWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          fitView
          minZoom={0.1}
          maxZoom={2}
          attributionPosition="bottom-left"
        >
          <Background color="#333" gap={40} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(node) => node.data?.color || '#666'}
            maskColor="rgba(0,0,0,0.7)"
            style={{ background: '#111', borderRadius: 8 }}
          />
        </ReactFlow>

        {/* Controls panel */}
        <div className={styles.controlsPanel}>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Types</option>
              {filterOptions.types.map(t => (
                <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>Research Area</label>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Areas</option>
              {filterOptions.areas.map(a => (
                <option key={a} value={a}>{a.replace(/-/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>
              Edge Strength: {minStrength.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.35"
              max="0.80"
              step="0.05"
              value={minStrength}
              onChange={(e) => setMinStrength(parseFloat(e.target.value))}
              className={styles.slider}
            />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>
              <input
                type="checkbox"
                checked={showBridges}
                onChange={(e) => setShowBridges(e.target.checked)}
              />
              {' '}Show Bridges ({bridgeCount})
            </label>
          </div>

          <div className={styles.stats}>
            <span>{clusterCount} clusters</span>
            <span>{edgeCount} edges</span>
            {hasFilter && <span>{filteredNodeIds.size} visible</span>}
          </div>
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          <div className={styles.legendTitle}>Edge Colors</div>
          <div className={styles.legendItem}>
            <div className={styles.legendLine} style={{ background: '#0066FF' }} />
            <span>Same cluster</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendLine} style={{ background: '#FF9500' }} />
            <span>Cross-cluster</span>
          </div>
        </div>

        {/* Focus hint */}
        {focusedNodeId && (
          <div className={styles.focusHint}>
            Focused view — click background to reset
          </div>
        )}
      </div>
    </div>
  );
}
