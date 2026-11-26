"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Pause, Play, RotateCcw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Panel } from "@/components/ui/Panel";
import { StatTile } from "@/components/ui/StatTile";
import { StatusDot } from "@/components/ui/StatusDot";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/Skeleton";
import { statusTone } from "@/lib/ui/status";
import { cssVar } from "@/lib/ui/cssVar";

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

type Tone = "accent" | "success" | "warning" | "danger" | "neutral";

// Relation type -> colour token (also named in the legend, never colour alone).
const relationTypeTones: Record<string, Tone> = {
    DEPENDS_ON: "danger",
    RUNS_ON: "accent",
    CONNECTED_TO: "success",
    CONTAINS: "warning",
};
const relationTone = (type: string): Tone => relationTypeTones[type] ?? "neutral";
const legendTypes: [string, Tone][] = [...Object.entries(relationTypeTones), ["OTHER", "neutral"]];
const swatchClass: Record<Tone, string> = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    neutral: "bg-neutral",
};
const statuses = ["ACTIVE", "MAINTENANCE", "DEPRECATED"];

interface Palette {
    surface: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    neutral: string;
    sans: string;
    mono: string;
}

function readPalette(): Palette {
    return {
        surface: cssVar("--surface"),
        text: cssVar("--text"),
        muted: cssVar("--text-muted"),
        border: cssVar("--border-strong"),
        accent: cssVar("--accent"),
        success: cssVar("--success"),
        warning: cssVar("--warning"),
        danger: cssVar("--danger"),
        neutral: cssVar("--neutral"),
        sans: cssVar("--font-sans") || "sans-serif",
        mono: cssVar("--font-mono") || "monospace",
    };
}

export default function RelationshipGraphPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
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
    const [palette, setPalette] = useState<Palette | null>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const sizeRef = useRef({ w: 1000, h: 700 });
    const hasGraph = nodes.length > 0;

    // Canvas colours come from the theme tokens; re-read when <html class> flips dark/light.
    useEffect(() => {
        const update = () => setPalette(readPalette());
        const raf = requestAnimationFrame(update);
        const observer = new MutationObserver(update);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
        };
    }, []);

    // Keep the canvas sized to its container.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const update = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            const prev = sizeRef.current;
            sizeRef.current = { w, h };
            setSize({ w, h });
            // Keep the layout inside the canvas when it resizes (matters while paused).
            if (w > 0 && h > 0 && prev.w > 0 && prev.h > 0 && (prev.w !== w || prev.h !== h)) {
                // Mutate in place so selected/hovered/dragged references stay valid.
                setNodes((nodesNow) => {
                    nodesNow.forEach((n) => {
                        n.x = (n.x * w) / prev.w;
                        n.y = (n.y * h) / prev.h;
                    });
                    return [...nodesNow];
                });
            }
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(container);
        return () => ro.disconnect();
    }, [loading, hasGraph]);


    // Fetch all relations
    useEffect(() => {
        const fetchRelations = async () => {
            try {
                setLoading(true);
                const res = await fetch("/api/relations");
                if (res.ok) {
                    const allRelations: Relation[] = await res.json();
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
                    x: Math.random() * Math.max(sizeRef.current.w - 200, 100) + 100,
                    y: Math.random() * Math.max(sizeRef.current.h - 200, 100) + 100,
                    vx: 0,
                    vy: 0,
                    radius: 25,
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
                    x: Math.random() * Math.max(sizeRef.current.w - 200, 100) + 100,
                    y: Math.random() * Math.max(sizeRef.current.h - 200, 100) + 100,
                    vx: 0,
                    vy: 0,
                    radius: 25,
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
        if (!animationEnabled || !hasGraph) return;

        setNodes((prevNodes) => {
            const newNodes = [...prevNodes];
            const { w: width, h: height } = sizeRef.current;
            const centerX = width / 2;
            const centerY = height / 2;
            // Scale the layout with the canvas so the graph uses the space.
            const k = Math.max(0.6, Math.min(2, Math.min(width, height) / 450));
            const repulsionForce = 5000 * k * k;
            const springLength = 150 * k;
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
                    node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
                    node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
                }
            });

            return newNodes;
        });
    }, [edges, draggedNode, animationEnabled, hasGraph]);

    // Animation loop
    useEffect(() => {
        if (animationEnabled && hasGraph) {
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
    }, [simulate, animationEnabled, hasGraph]);

    // Draw the graph
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx || !palette || size.w === 0) return;

        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(size.w * dpr) || canvas.height !== Math.round(size.h * dpr)) {
            canvas.width = Math.round(size.w * dpr);
            canvas.height = Math.round(size.h * dpr);
        }
        const toneColor = (tone: Tone) => palette[tone];

        // Clear canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = palette.surface;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply transform
        ctx.save();
        ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * offset.x, dpr * offset.y);

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
            ctx.strokeStyle = toneColor(relationTone(edge.type));
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw arrow
            const angle = Math.atan2(target.y - source.y, target.x - source.x);
            const arrowLength = 10;
            const arrowAngle = Math.PI / 6;
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
                ctx.fillStyle = toneColor(relationTone(edge.type));
                ctx.font = `10px ${palette.sans}`;
                ctx.textAlign = "center";
                ctx.fillText(edge.type.replace(/_/g, " "), midX, midY - 5);
            }
        });

        // Draw nodes
        filteredNodes.forEach((node) => {
            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = toneColor(statusTone(node.status).tone);
            ctx.fill();

            // Highlight hovered or selected
            if (node === hoveredNode || node === selectedNode) {
                ctx.strokeStyle = palette.accent;
                ctx.lineWidth = 3;
                ctx.stroke();
            } else {
                ctx.strokeStyle = palette.border;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Node label
            if (showLabels) {
                ctx.fillStyle = palette.text;
                ctx.font = `bold 12px ${palette.mono}`;
                ctx.textAlign = "center";
                ctx.fillText(node.name.substring(0, 15), node.x, node.y + node.radius + 15);

                if (node.typeName) {
                    ctx.fillStyle = palette.muted;
                    ctx.font = `10px ${palette.sans}`;
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
            ctx.fillStyle = toneColor(statusTone(node.status).tone);
            ctx.fill();
            ctx.strokeStyle = palette.surface;
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        ctx.restore();
    }, [nodes, edges, hoveredNode, selectedNode, filterType, searchQuery, zoom, offset, showLabels, palette, size]);

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

    const handleMouseDown = () => {
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

    // Native non-passive listener so preventDefault stops the page from scrolling while zooming.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom((prev) => Math.max(0.5, Math.min(2, prev * delta)));
        };
        canvas.addEventListener("wheel", handleWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", handleWheel);
    }, [loading, hasGraph]);

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
            <div className="flex h-96 items-center justify-center">
                <LoadingSpinner size="xl" />
            </div>
        );
    }

    const statTiles: { label: string; value: number; tone: "accent" | "success" | "warning" | "neutral" }[] = [
        { label: "Assets", value: stats.totalNodes, tone: "accent" },
        { label: "Relations", value: stats.totalEdges, tone: "accent" },
        { label: "Active", value: stats.activeNodes, tone: "success" },
        { label: "Maintenance", value: stats.maintenanceNodes, tone: "warning" },
        { label: "Deprecated", value: stats.deprecatedNodes, tone: "neutral" },
    ];

    return (
        <div>
            <PageHeader
                title="Relationship Graph"
                description="Visualize connections between your configuration items"
                actions={
                    <>
                        <Button onClick={() => setAnimationEnabled(!animationEnabled)} variant="secondary">
                            {animationEnabled ? (
                                <Pause className="size-4" aria-hidden="true" />
                            ) : (
                                <Play className="size-4" aria-hidden="true" />
                            )}
                            {animationEnabled ? "Pause" : "Play"}
                        </Button>
                        <Button
                            onClick={() => {
                                setZoom(1);
                                setOffset({ x: 0, y: 0 });
                            }}
                            variant="secondary"
                        >
                            <RotateCcw className="size-4" aria-hidden="true" />
                            Reset View
                        </Button>
                    </>
                }
            />

            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
                {statTiles.map((t) => (
                    <StatTile key={t.label} label={t.label} value={t.value} tone={t.tone} />
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {/* Controls */}
                <div className="space-y-4 lg:col-span-1">
                    <Panel title="Filter">
                        <div className="space-y-4">
                            <Field label="Search Assets" htmlFor="graph-search">
                                <Input
                                    id="graph-search"
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </Field>
                            <Field label="Filter by Relation Type" htmlFor="graph-filter">
                                <Select
                                    id="graph-filter"
                                    value={filterType}
                                    onValueChange={setFilterType}
                                    options={[
                                        { value: "ALL", label: "All Types" },
                                        ...relationTypes.map((type) => ({
                                            value: type,
                                            label: type.replace(/_/g, " "),
                                        })),
                                    ]}
                                />
                            </Field>
                        </div>
                    </Panel>

                    <Panel title="Display Options">
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm text-text">
                                <Checkbox checked={showLabels} onCheckedChange={(c) => setShowLabels(c === true)} />
                                Show Labels
                            </label>
                            <label className="flex items-center gap-2 text-sm text-text">
                                <Checkbox
                                    checked={animationEnabled}
                                    onCheckedChange={(c) => setAnimationEnabled(c === true)}
                                />
                                Animation
                            </label>
                        </div>
                    </Panel>

                    <Panel title="Legend">
                        <h3 className="mb-2 text-xs font-medium text-muted">Status</h3>
                        <div className="space-y-2">
                            {statuses.map((status) => (
                                <div key={status}>
                                    <StatusDot status={status} />
                                </div>
                            ))}
                        </div>
                        <h3 className="mb-2 mt-4 text-xs font-medium text-muted">Relation Types</h3>
                        <div className="space-y-2">
                            {legendTypes.map(([type, tone]) => (
                                <div key={type} className="flex items-center gap-2">
                                    <span className={`h-1 w-8 shrink-0 rounded ${swatchClass[tone]}`} aria-hidden="true" />
                                    <span className="text-sm text-text">{type.replace(/_/g, " ")}</span>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    {selectedNode && (
                        <Panel title="Selected Asset">
                            <div className="space-y-2">
                                <p className="break-all font-mono text-sm font-semibold text-text">{selectedNode.name}</p>
                                {selectedNode.typeName && (
                                    <p className="text-sm text-muted">Type: {selectedNode.typeName}</p>
                                )}
                                <StatusDot status={selectedNode.status} />
                                <Link
                                    href={`/items/${selectedNode.id}`}
                                    className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg transition-colors hover:bg-accent/90 max-sm:min-h-11"
                                >
                                    View Details
                                </Link>
                            </div>

                            <div className="mt-4 border-t border-border pt-4">
                                <h4 className="mb-2 text-sm font-medium text-text">Connections</h4>
                                <div className="max-h-40 space-y-1 overflow-y-auto">
                                    {getConnectedNodes(selectedNode.id).map(({ node, relation }, idx) => (
                                        <button
                                            type="button"
                                            key={idx}
                                            className="block w-full rounded bg-surface-2 p-2 text-left text-xs hover:bg-border"
                                            onClick={() => setSelectedNode(node)}
                                        >
                                            <span className="block break-all font-mono font-medium text-text">{node.name}</span>
                                            <span className="block text-muted">
                                                {relation.type.replace(/_/g, " ")}
                                            </span>
                                        </button>
                                    ))}
                                    {getConnectedNodes(selectedNode.id).length === 0 && (
                                        <p className="text-xs italic text-muted">No connections</p>
                                    )}
                                </div>
                            </div>
                        </Panel>
                    )}
                </div>

                {/* Graph Canvas */}
                <div className="min-w-0 lg:col-span-3">
                    {!hasGraph ? (
                        <EmptyState
                            icon={Share2}
                            title="No Relations Found"
                            description='Create relations between your configuration items to see them visualized here. Go to any item and click "Relations" to get started.'
                        />
                    ) : (
                        <div
                            ref={containerRef}
                            className="h-[480px] overflow-hidden rounded-lg border border-border bg-surface lg:h-[700px]"
                        >
                            <canvas
                                ref={canvasRef}
                                role="img"
                                aria-label={`Relationship graph, ${stats.totalNodes} assets, ${stats.totalEdges} relations`}
                                className="block h-full w-full cursor-move"
                                onMouseMove={handleMouseMove}
                                onMouseDown={handleMouseDown}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            />
                        </div>
                    )}
                    <p className="mt-2 text-sm text-muted">
                        Tip: click and drag nodes to reposition them. Use the mouse wheel to zoom.
                    </p>
                </div>
            </div>
        </div>
    );
}
