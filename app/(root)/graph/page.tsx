"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/Skeleton";
import Link from "next/link";

interface GraphNode {
    id: string;
    name: string;
    type: string;
    typeName?: string;
    status: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
}

interface GraphEdge {
    source: string;
    target: string;
    type: string;
    description?: string;
}

interface Relation {
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
    description?: string;
    source: {
        id: string;
        name: string;
        status: string;
        itemType?: { name: string } | null;
    };
    target: {
        id: string;
        name: string;
        status: string;
        itemType?: { name: string } | null;
    };
}

const statusColors: Record<string, string> = {
    ACTIVE: "#22c55e",
    DEPRECATED: "#ef4444",
    MAINTENANCE: "#eab308",
};

const relationTypeColors: Record<string, string> = {
    DEPENDS_ON: "#ef4444",
    RUNS_ON: "#3b82f6",
    CONNECTED_TO: "#22c55e",
    CONTAINS: "#a855f7",
    DEFAULT: "#6b7280",
};

export default function RelationshipGraphPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [relations, setRelations] = useState<Relation[]>([]);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const [filterType, setFilterType] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [draggedNode, setDraggedNode] = useState<GraphNode | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [showLabels, setShowLabels] = useState(true);
    const [animationEnabled, setAnimationEnabled] = useState(true);

    const animationRef = useRef<number | undefined>(undefined);
    const transformRef = useRef({ x: 0, y: 0, scale: 1 });

    // Fetch all relations
    useEffect(() => {
        const fetchRelations = async () => {
            try {
                setLoading(true);
                const res = await fetch("/api/configuration-items/available-for-relations");
                if (res.ok) {
                    const data = await res.json();
                    // Extract unique relations from items
                    const allRelations: Relation[] = [];
                    data.forEach((item: any) => {
                        if (item.relationsFrom) {
                            item.relationsFrom.forEach((rel: any) => {
                                allRelations.push({
                                    ...rel,
                                    source: item,
                                    target: rel.target,
                                });
                            });
                        }
                    });
                    setRelations(allRelations);
                    initializeGraph(allRelations);
                }
            } catch (error) {
                console.error("Error fetching relations:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRelations();
    }, []);

    // Initialize graph nodes and edges
    const initializeGraph = (relations: Relation[]) => {
        const nodeMap = new Map<string, GraphNode>();
        const newEdges: GraphEdge[] = [];

        relations.forEach((rel) => {
            // Add source node
            if (!nodeMap.has(rel.source.id)) {
                nodeMap.set(rel.source.id, {
                    id: rel.source.id,
                    name: rel.source.name,
                    type: "ConfigurationItem",
                    typeName: rel.source.itemType?.name,
                    status: rel.source.status,
                    x: Math.random() * 800 + 100,
                    y: Math.random() * 600 + 100,
                    vx: 0,
                    vy: 0,
                    radius: 25,
                    color: statusColors[rel.source.status] || "#6b7280",
                });
            }

            // Add target node
            if (!nodeMap.has(rel.target.id)) {
                nodeMap.set(rel.target.id, {
                    id: rel.target.id,
                    name: rel.target.name,
                    type: "ConfigurationItem",
                    typeName: rel.target.itemType?.name,
                    status: rel.target.status,
                    x: Math.random() * 800 + 100,
                    y: Math.random() * 600 + 100,
                    vx: 0,
                    vy: 0,
                    radius: 25,
                    color: statusColors[rel.target.status] || "#6b7280",
                });
            }

            // Add edge
            newEdges.push({
                source: rel.source.id,
                target: rel.target.id,
                type: rel.type,
                description: rel.description,
            });
        });

        setNodes(Array.from(nodeMap.values()));
        setEdges(newEdges);
    };

    // Force-directed graph simulation
    const simulate = useCallback(() => {
        if (!animationEnabled) return;

        setNodes((prevNodes) => {
            const newNodes = [...prevNodes];
            const centerX = 500;
            const centerY = 400;
            const repulsionForce = 5000;
            const springLength = 150;
            const springStrength = 0.05;
            const centerStrength = 0.01;

            // Apply forces
            for (let i = 0; i < newNodes.length; i++) {
                const node = newNodes[i];

                // Repulsion from other nodes
                for (let j = 0; j < newNodes.length; j++) {
                    if (i === j) continue;
                    const other = newNodes[j];
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = repulsionForce / (dist * dist);
                    node.vx += (dx / dist) * force;
                    node.vy += (dy / dist) * force;
                }

                // Attraction to center
                node.vx += (centerX - node.x) * centerStrength;
                node.vy += (centerY - node.y) * centerStrength;

                // Damping
                node.vx *= 0.9;
                node.vy *= 0.9;
            }

            // Spring force along edges
            edges.forEach((edge) => {
                const source = newNodes.find((n) => n.id === edge.source);
                const target = newNodes.find((n) => n.id === edge.target);
                if (source && target) {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = (dist - springLength) * springStrength;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    source.vx += fx;
                    source.vy += fy;
                    target.vx -= fx;
                    target.vy -= fy;
                }
            });

            // Update positions
            newNodes.forEach((node) => {
                if (node !== draggedNode) {
                    node.x += node.vx;
                    node.y += node.vy;

                    // Keep within bounds
                    node.x = Math.max(node.radius, Math.min(1000 - node.radius, node.x));
                    node.y = Math.max(node.radius, Math.min(800 - node.radius, node.y));
                }
            });

            return newNodes;
        });
    }, [edges, draggedNode, animationEnabled]);

    // Animation loop
    useEffect(() => {
        if (animationEnabled) {
            const animate = () => {
                simulate();
                animationRef.current = requestAnimationFrame(animate);
            };
            animationRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [simulate, animationEnabled]);

    // Draw the graph
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply transform
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);

        // Filter nodes based on search
        const filteredNodes = nodes.filter((node) =>
            searchQuery === "" ||
            node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            node.typeName?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

        // Filter edges
        const filteredEdges = edges.filter(
            (edge) =>
                filteredNodeIds.has(edge.source) &&
                filteredNodeIds.has(edge.target) &&
                (filterType === "ALL" || edge.type === filterType)
        );

        // Draw edges
        filteredEdges.forEach((edge) => {
            const source = nodes.find((n) => n.id === edge.source);
            const target = nodes.find((n) => n.id === edge.target);
            if (!source || !target) return;

            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = relationTypeColors[edge.type] || relationTypeColors.DEFAULT;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw arrow
            const angle = Math.atan2(target.y - source.y, target.x - source.x);
            const arrowLength = 10;
            const arrowAngle = Math.PI / 6;
            const dist = Math.sqrt(
                Math.pow(target.x - source.x, 2) + Math.pow(target.y - source.y, 2)
            );
            const arrowX = target.x - (Math.cos(angle) * target.radius);
            const arrowY = target.y - (Math.sin(angle) * target.radius);

            ctx.beginPath();
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(
                arrowX - arrowLength * Math.cos(angle - arrowAngle),
                arrowY - arrowLength * Math.sin(angle - arrowAngle)
            );
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(
                arrowX - arrowLength * Math.cos(angle + arrowAngle),
                arrowY - arrowLength * Math.sin(angle + arrowAngle)
            );
            ctx.stroke();

            // Draw relation type label
            if (showLabels) {
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                ctx.fillStyle = relationTypeColors[edge.type] || relationTypeColors.DEFAULT;
                ctx.font = "10px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(edge.type.replace(/_/g, " "), midX, midY - 5);
            }
        });

        // Draw nodes
        filteredNodes.forEach((node) => {
            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.fill();

            // Highlight hovered or selected
            if (node === hoveredNode || node === selectedNode) {
                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth = 3;
                ctx.stroke();
            } else {
                ctx.strokeStyle = "#374151";
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Node label
            if (showLabels) {
                ctx.fillStyle = "#1f2937";
                ctx.font = "bold 12px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(node.name.substring(0, 15), node.x, node.y + node.radius + 15);

                if (node.typeName) {
                    ctx.fillStyle = "#6b7280";
                    ctx.font = "10px sans-serif";
                    ctx.fillText(node.typeName, node.x, node.y + node.radius + 28);
                }
            }

            // Status indicator
            ctx.beginPath();
            ctx.arc(
                node.x + node.radius * 0.7,
                node.y - node.radius * 0.7,
                6,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = statusColors[node.status] || "#6b7280";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        ctx.restore();
    }, [nodes, edges, hoveredNode, selectedNode, filterType, searchQuery, zoom, offset, showLabels]);

    // Mouse handlers
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - offset.x) / zoom;
        const y = (e.clientY - rect.top - offset.y) / zoom;

        if (isDragging && draggedNode) {
            draggedNode.x = x;
            draggedNode.y = y;
            draggedNode.vx = 0;
            draggedNode.vy = 0;
            setNodes([...nodes]);
            return;
        }

        // Find hovered node
        const hovered = nodes.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= node.radius;
        });

        setHoveredNode(hovered || null);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (hoveredNode) {
            setIsDragging(true);
            setDraggedNode(hoveredNode);
            setSelectedNode(hoveredNode);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDraggedNode(null);
    };

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom((prev) => Math.max(0.5, Math.min(2, prev * delta)));
    };

    // Get unique relation types
    const relationTypes = Array.from(new Set(edges.map((e) => e.type)));

    // Stats
    const stats = {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        activeNodes: nodes.filter((n) => n.status === "ACTIVE").length,
        deprecatedNodes: nodes.filter((n) => n.status === "DEPRECATED").length,
        maintenanceNodes: nodes.filter((n) => n.status === "MAINTENANCE").length,
    };

    // Get connected nodes for selected node
    const getConnectedNodes = (nodeId: string) => {
        const connected: { node: GraphNode; relation: GraphEdge }[] = [];
        edges.forEach((edge) => {
            if (edge.source === nodeId) {
                const target = nodes.find((n) => n.id === edge.target);
                if (target) connected.push({ node: target, relation: edge });
            } else if (edge.target === nodeId) {
                const source = nodes.find((n) => n.id === edge.source);
                if (source) connected.push({ node: source, relation: { ...edge, type: `${edge.type} (incoming)` } });
            }
        });
        return connected;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <main className="max-w-7xl mx-auto p-8">
                    <div className="flex justify-center items-center h-96">
                        <LoadingSpinner size="lg" />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-7xl mx-auto p-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-800">Relationship Graph</h1>
                        <p className="text-gray-600 mt-1">
                            Visualize connections between your configuration items
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setAnimationEnabled(!animationEnabled)} variant="outline">
                            {animationEnabled ? "⏸ Pause" : "▶ Play"}
                        </Button>
                        <Button
                            onClick={() => {
                                setZoom(1);
                                setOffset({ x: 0, y: 0 });
                            }}
                            variant="outline"
                        >
                            Reset View
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Assets</p>
                        <p className="text-2xl font-bold text-brand-primary">{stats.totalNodes}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Relations</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.totalEdges}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Active</p>
                        <p className="text-2xl font-bold text-green-600">{stats.activeNodes}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Maintenance</p>
                        <p className="text-2xl font-bold text-yellow-600">{stats.maintenanceNodes}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-600">Deprecated</p>
                        <p className="text-2xl font-bold text-red-600">{stats.deprecatedNodes}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Controls */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Search */}
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Search Assets</label>
                            <input
                                type="text"
                                placeholder="Search by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>

                        {/* Filter by Relation Type */}
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Filter by Relation Type
                            </label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-primary"
                            >
                                <option value="ALL">All Types</option>
                                {relationTypes.map((type) => (
                                    <option key={type} value={type}>
                                        {type.replace(/_/g, " ")}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Display Options */}
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Display Options</h3>
                            <label className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    checked={showLabels}
                                    onChange={(e) => setShowLabels(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm text-gray-600">Show Labels</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={animationEnabled}
                                    onChange={(e) => setAnimationEnabled(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm text-gray-600">Animation</span>
                            </label>
                        </div>

                        {/* Legend */}
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Status Legend</h3>
                            <div className="space-y-2">
                                {Object.entries(statusColors).map(([status, color]) => (
                                    <div key={status} className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: color }}
                                        />
                                        <span className="text-sm text-gray-600">{status}</span>
                                    </div>
                                ))}
                            </div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3 mt-4">Relation Types</h3>
                            <div className="space-y-2">
                                {Object.entries(relationTypeColors).map(([type, color]) => (
                                    <div key={type} className="flex items-center gap-2">
                                        <div
                                            className="w-8 h-1 rounded"
                                            style={{ backgroundColor: color }}
                                        />
                                        <span className="text-sm text-gray-600">{type.replace(/_/g, " ")}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Selected Node Details */}
                        {selectedNode && (
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h3 className="text-sm font-medium text-gray-700 mb-3">Selected Asset</h3>
                                <div className="space-y-2">
                                    <p className="font-semibold text-gray-800">{selectedNode.name}</p>
                                    {selectedNode.typeName && (
                                        <p className="text-sm text-gray-600">Type: {selectedNode.typeName}</p>
                                    )}
                                    <p className="text-sm text-gray-600">
                                        Status:{" "}
                                        <span
                                            className="inline-flex w-2 h-2 rounded-full ml-1"
                                            style={{ backgroundColor: selectedNode.color }}
                                        />
                                        {" "}{selectedNode.status}
                                    </p>
                                    <Link href={`/items/${selectedNode.id}`}>
                                        <Button size="sm" className="w-full mt-2">
                                            View Details →
                                        </Button>
                                    </Link>
                                </div>

                                {/* Connected nodes */}
                                <div className="mt-4 pt-4 border-t">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Connections</h4>
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                        {getConnectedNodes(selectedNode.id).map(({ node, relation }, idx) => (
                                            <div
                                                key={idx}
                                                className="text-xs p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                                                onClick={() => setSelectedNode(node)}
                                            >
                                                <span className="font-medium">{node.name}</span>
                                                <span
                                                    className="block text-gray-500"
                                                    style={{ color: relationTypeColors[relation.type] }}
                                                >
                                                    {relation.type.replace(/_/g, " ")}
                                                </span>
                                            </div>
                                        ))}
                                        {getConnectedNodes(selectedNode.id).length === 0 && (
                                            <p className="text-xs text-gray-500 italic">No connections</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Graph Canvas */}
                    <div className="lg:col-span-3">
                        <div
                            ref={containerRef}
                            className="bg-white rounded-lg shadow-sm overflow-hidden"
                            style={{ height: "700px" }}
                        >
                            {nodes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <svg
                                        className="w-16 h-16 mb-4 text-gray-300"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M13 10V3L4 14h7v7l9-11h-7z"
                                        />
                                    </svg>
                                    <h3 className="text-lg font-medium mb-2">No Relations Found</h3>
                                    <p className="text-sm text-center max-w-md">
                                        Create relations between your configuration items to see them visualized here.
                                        Go to any item and click &quot;Relations&quot; to get started.
                                    </p>
                                </div>
                            ) : (
                                <canvas
                                    ref={canvasRef}
                                    width={1000}
                                    height={800}
                                    className="w-full h-full cursor-move"
                                    onMouseMove={handleMouseMove}
                                    onMouseDown={handleMouseDown}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    onWheel={handleWheel}
                                />
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                            💡 Tip: Click and drag nodes to reposition them. Use mouse wheel to zoom.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
