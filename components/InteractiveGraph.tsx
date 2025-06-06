import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, unknown>;
}

interface GraphRelationship {
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

interface InteractiveGraphProps {
  data: GraphData;
}

const InteractiveGraph: React.FC<InteractiveGraphProps> = ({ data }) => {
  // Memoize initial node positions to prevent recalculation
  const initialNodes = useMemo((): PositionedNode[] => {
    const centerX = 400;
    const centerY = 200;
    const radius = 150;
    
    return data.nodes.map((node, index) => {
      const angle = (index / Math.max(data.nodes.length, 1)) * 2 * Math.PI;
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    });
  }, [data.nodes]);

  const [nodes, setNodes] = useState<PositionedNode[]>(initialNodes);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Update nodes when data changes - use effect to prevent blocking
  useEffect(() => {
    // Use setTimeout to prevent blocking the main thread
    const timeoutId = setTimeout(() => {
      setNodes(initialNodes);
      setSelectedNode(null);
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [initialNodes]);

  // Simple colors: blue for entities, green for relationships
  const getNodeColor = useCallback(() => '#3b82f6', []); // bg-blue-500

  // Zoom controls - memoized to prevent recreation
  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, 3)); // Max zoom 3x
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.2, 0.3)); // Min zoom 0.3x
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Optimized event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, node: PositionedNode) => {
    e.preventDefault();
    e.stopPropagation();
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    setDragging(node.id);
    setDragOffset({
      x: (e.clientX - rect.left) / zoom - panOffset.x - node.x,
      y: (e.clientY - rect.top) / zoom - panOffset.y - node.y
    });
  }, [zoom, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    
    if (dragging) {
      // Dragging a node
      const newX = (e.clientX - rect.left) / zoom - panOffset.x - dragOffset.x;
      const newY = (e.clientY - rect.top) / zoom - panOffset.y - dragOffset.y;

      setNodes(prevNodes =>
        prevNodes.map(node =>
          node.id === dragging
            ? { 
                ...node, 
                x: Math.max(30, Math.min(770, newX)), 
                y: Math.max(30, Math.min(370, newY)) 
              }
            : node
        )
      );
    } else if (isPanning) {
      // Panning the background
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX / zoom,
        y: prev.y + deltaY / zoom
      }));
      
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [dragging, isPanning, zoom, panOffset, dragOffset, panStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
  }, []);

  const handleBackgroundMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).tagName === 'rect') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, []);

  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNode(selectedNode === nodeId ? null : nodeId);
  }, [selectedNode]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Memoize expensive calculations
  const isRelationshipHighlighted = useCallback((rel: GraphRelationship) => {
    return selectedNode === rel.source || selectedNode === rel.target;
  }, [selectedNode]);

  const isNodeConnected = useCallback((nodeId: string) => {
    if (!selectedNode) return false;
    return data.relationships.some(rel => 
      (rel.source === selectedNode && rel.target === nodeId) ||
      (rel.target === selectedNode && rel.source === nodeId)
    );
  }, [selectedNode, data.relationships]);

  const getConnectionPath = useCallback((sourceId: string, targetId: string) => {
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    
    if (!source || !target) return '';
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  }, [nodes]);

  const getRelationshipMidpoint = useCallback((sourceId: string, targetId: string) => {
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    
    if (!source || !target) return { x: 0, y: 0 };
    return {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2
    };
  }, [nodes]);

  // Early return if no data to prevent rendering issues
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="w-full h-full p-8 text-center">
        <p className="text-gray-500">No data to display</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {/* Success message with relationship details */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-green-800 mb-2">Processing Complete!</h4>
        <p className="text-green-700 text-sm">
          Found {data.nodes.length} entities and {data.relationships.length} relationships
        </p>
        {/* Show all relationship types found */}
        <div className="mt-2 text-xs text-green-600">
          <strong>Relationship types found:</strong> {[...new Set(data.relationships.map(rel => rel.type))].join(', ')}
        </div>
      </div>

      {/* Graph Controls */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center space-x-4 flex-wrap">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-sm text-gray-600">Entities ({data.nodes.length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">Relationships ({data.relationships.length})</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleBackgroundClick}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
          >
            Clear Selection
          </button>
          <div className="flex items-center space-x-1 border-l pl-2 ml-2">
            <button
              onClick={zoomIn}
              className="p-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={zoomOut}
              className="p-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetZoom}
              className="p-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 ml-2">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* SVG Graph */}
      <svg
        ref={svgRef}
        width="100%"
        height="400"
        className={`border-l border-r border-b rounded-b-lg ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleBackgroundMouseDown}
        onClick={handleBackgroundClick}
        style={{ backgroundColor: '#fafafa' }}
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Zoomable content group */}
        <g transform={`scale(${zoom}) translate(${panOffset.x}, ${panOffset.y})`}>
          {/* Relationships */}
          {data.relationships.map((rel, index) => {
            const isHighlighted = isRelationshipHighlighted(rel);
            const midpoint = getRelationshipMidpoint(rel.source, rel.target);
            
            return (
              <g key={index}>
                <path
                  d={getConnectionPath(rel.source, rel.target)}
                  stroke={isHighlighted ? "#f59e0b" : "#22c55e"}
                  strokeWidth={isHighlighted ? "3" : "2"}
                  fill="none"
                  opacity={selectedNode && !isHighlighted ? 0.3 : 0.8}
                  className="pointer-events-none"
                />
                {/* Relationship label */}
                {isHighlighted && (
                  <g>
                    <rect
                      x={midpoint.x - rel.type.length * 3}
                      y={midpoint.y - 8}
                      width={rel.type.length * 6}
                      height="16"
                      fill="white"
                      stroke="#d1d5db"
                      rx="4"
                      className="pointer-events-none"
                    />
                    <text
                      x={midpoint.x}
                      y={midpoint.y + 4}
                      textAnchor="middle"
                      className="text-xs fill-gray-700 pointer-events-none font-medium"
                    >
                      {rel.type}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNode === node.id;
            const isConnected = isNodeConnected(node.id);
            const nodeOpacity = selectedNode && !isSelected && !isConnected ? 0.3 : 1;
            
            return (
              <g
                key={node.id}
                className="cursor-pointer select-none"
                onMouseDown={(e) => handleMouseDown(e, node)}
                onClick={(e) => handleNodeClick(e, node.id)}
                style={{ opacity: nodeOpacity }}
              >
                {/* Node glow effect when selected */}
                {isSelected && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="35"
                    fill={getNodeColor()}
                    opacity="0.3"
                    className="pointer-events-none"
                  />
                )}
                
                {/* Main node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? "28" : "24"}
                  fill={getNodeColor()}
                  stroke={isSelected ? "#374151" : "#6b7280"}
                  strokeWidth={isSelected ? "3" : "2"}
                  className="transition-all duration-200 hover:stroke-gray-900"
                />
                
                {/* Node label */}
                <text
                  x={node.x}
                  y={node.y + 40}
                  textAnchor="middle"
                  className="text-sm fill-gray-900 font-medium pointer-events-none"
                  style={{ fontSize: '12px' }}
                >
                  {node.id.length > 15 ? `${node.id.substring(0, 12)}...` : node.id}
                </text>
                
                {/* Node type */}
                <text
                  x={node.x}
                  y={node.y + 55}
                  textAnchor="middle"
                  className="text-xs fill-gray-500 pointer-events-none"
                  style={{ fontSize: '10px' }}
                >
                  ({node.type})
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Instructions and Debug Info */}
      <div className="mt-3 space-y-3">
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>• <strong>Drag nodes</strong> to reposition them</div>
            <div>• <strong>Drag background</strong> to pan around when zoomed</div>
            <div>• <strong>Click nodes</strong> to highlight relationships</div>
            <div>• <strong>Use zoom controls</strong> for better visibility</div>
          </div>
        </div>
        
        {/* Debug: Show all relationships */}
        <details className="bg-gray-50 rounded-lg">
          <summary className="p-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
            🔍 Debug: View All Extracted Relationships ({data.relationships.length})
          </summary>
          <div className="p-3 pt-0 space-y-1 max-h-40 overflow-y-auto">
            {data.relationships.map((rel, index) => (
              <div key={index} className="text-xs p-2 bg-white rounded border">
                <strong>{rel.source}</strong> 
                <span className="mx-2 text-green-600 font-medium">—{rel.type}→</span> 
                <strong>{rel.target}</strong>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};

export default InteractiveGraph;