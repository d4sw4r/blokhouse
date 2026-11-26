'use client';

import { useState, useEffect } from "react";
import { Check, Cog, Link2, Network, Package, Plug, Plus, Puzzle, Server, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusDot } from "@/components/ui/StatusDot";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";

interface RelationTarget {
  id: string;
  name: string;
  ip?: string | null;
  status: string;
  itemType?: { name: string } | null;
}

interface AssetRelation {
  id: string;
  type: string;
  description?: string | null;
  createdAt: string;
  target: RelationTarget;
  direction: "outgoing" | "incoming";
}

interface RelationsData {
  outgoing: AssetRelation[];
  incoming: AssetRelation[];
  all: AssetRelation[];
}

interface AvailableItem {
  id: string;
  name: string;
  ip?: string | null;
  status: string;
  itemType?: { name: string } | null;
}

const relationTypes: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "DEPENDS_ON", label: "Depends On", icon: Link2 },
  { value: "RUNS_ON", label: "Runs On", icon: Server },
  { value: "CONNECTED_TO", label: "Connected To", icon: Plug },
  { value: "CONTAINS", label: "Contains", icon: Package },
  { value: "PART_OF", label: "Part Of", icon: Puzzle },
  { value: "MANAGES", label: "Manages", icon: Cog },
];

interface AssetRelationsProps {
  itemId: string;
  itemName: string;
}

export default function AssetRelations({ itemId, itemName }: AssetRelationsProps) {
  const [relations, setRelations] = useState<RelationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("DEPENDS_ON");
  const [description, setDescription] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "outgoing" | "incoming">("all");

  useEffect(() => {
    fetchRelations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    if (showAddModal) {
      fetchAvailableItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddModal, searchQuery]);

  const fetchRelations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/configuration-items/${itemId}/relations`);
      if (res.ok) {
        const data = await res.json();
        setRelations(data);
      }
    } catch (error) {
      console.error("Error fetching relations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableItems = async () => {
    try {
      const params = new URLSearchParams({
        exclude: itemId,
        ...(searchQuery ? { search: searchQuery } : {}),
      });
      const res = await fetch(`/api/configuration-items/available-for-relations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableItems(data);
      }
    } catch (error) {
      console.error("Error fetching available items:", error);
    }
  };

  const createRelation = async () => {
    if (!selectedTarget || !selectedType) return;

    try {
      const res = await fetch(`/api/configuration-items/${itemId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: selectedTarget,
          type: selectedType,
          description: description || undefined,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setSelectedTarget("");
        setSelectedType("DEPENDS_ON");
        setDescription("");
        setSearchQuery("");
        fetchRelations();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || "Failed to create relation"}`);
      }
    } catch (error) {
      console.error("Error creating relation:", error);
      alert("Network error while creating relation");
    }
  };

  const deleteRelation = async (relationId: string) => {
    if (!confirm("Are you sure you want to delete this relation?")) return;

    try {
      const res = await fetch(
        `/api/configuration-items/${itemId}/relations/${relationId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        fetchRelations();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || "Failed to delete relation"}`);
      }
    } catch (error) {
      console.error("Error deleting relation:", error);
      alert("Network error while deleting relation");
    }
  };

  const getRelationTypeLabel = (type: string) => {
    return relationTypes.find((t) => t.value === type)?.label || type;
  };

  const getRelationTypeIcon = (type: string): LucideIcon => {
    return relationTypes.find((t) => t.value === type)?.icon || Link2;
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setSelectedTarget("");
    setDescription("");
    setSearchQuery("");
  };

  const displayedRelations = relations
    ? activeTab === "all"
      ? relations.all
      : relations[activeTab]
    : [];

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-muted">
          Define relationships between this asset and others
        </p>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add Relation
        </Button>
      </div>

      {relations && (relations.outgoing.length > 0 || relations.incoming.length > 0) && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "all" | "outgoing" | "incoming")}
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value="all">All ({relations.all.length})</TabsTrigger>
            <TabsTrigger value="outgoing">Outgoing ({relations.outgoing.length})</TabsTrigger>
            <TabsTrigger value="incoming">Incoming ({relations.incoming.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted" role="status">Loading relations...</p>
      ) : displayedRelations.length === 0 ? (
        <EmptyState
          icon={Network}
          title={
            relations?.all.length === 0
              ? "No relations defined yet"
              : "No relations in this category"
          }
          description={
            relations?.all.length === 0
              ? "Add a relation to connect this asset with others."
              : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {displayedRelations.map((relation) => {
            const Icon = getRelationTypeIcon(relation.type);
            const self = <span className="font-mono break-all text-text">{itemName}</span>;
            const other = <span className="font-mono break-all text-text">{relation.target.name}</span>;
            return (
              <li
                key={relation.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {relation.direction === "outgoing" ? self : other}
                      <Badge>{getRelationTypeLabel(relation.type)}</Badge>
                      {relation.direction === "outgoing" ? other : self}
                    </div>
                    {relation.description && (
                      <p className="mt-1 text-sm break-words text-muted">{relation.description}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{relation.target.itemType?.name || "No Type"}</span>
                      {relation.target.ip && <span className="font-mono break-all">{relation.target.ip}</span>}
                      <StatusDot status={relation.target.status} className="text-xs text-muted" />
                    </div>
                  </div>
                </div>
                <Button onClick={() => deleteRelation(relation.id)} variant="danger" size="sm">
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          if (!open) closeAddModal();
        }}
      >
        <DialogContent
          title="Add New Relation"
          footer={
            <>
              <Button variant="secondary" onClick={closeAddModal}>
                Cancel
              </Button>
              <Button onClick={createRelation} disabled={!selectedTarget}>
                Create Relation
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field
              label="Relation Type *"
              htmlFor="relation-type"
              hint={
                <>
                  <span className="font-mono break-all">{itemName}</span>{" "}
                  <span className="font-medium text-text">
                    {getRelationTypeLabel(selectedType).toLowerCase()}
                  </span>{" "}
                  the selected asset
                </>
              }
            >
              <Select
                id="relation-type"
                value={selectedType}
                onValueChange={setSelectedType}
                options={relationTypes.map((t) => ({ value: t.value, label: t.label }))}
              />
            </Field>

            <Field label="Target Asset *" htmlFor="relation-target-search">
              <Input
                id="relation-target-search"
                type="text"
                placeholder="Search assets by name or IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Field>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border">
              {availableItems.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted">
                  {searchQuery ? "No matching assets found" : "Type to search for assets"}
                </div>
              ) : (
                availableItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selectedTarget === item.id}
                    onClick={() => setSelectedTarget(item.id)}
                    className={cn(
                      "block w-full border-b border-border p-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-surface-2 motion-reduce:transition-none",
                      selectedTarget === item.id && "bg-surface-2",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 font-mono text-sm font-medium break-all text-text">{item.name}</span>
                      {selectedTarget === item.id && (
                        <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{item.itemType?.name || "No Type"}</span>
                      {item.ip && <span className="font-mono break-all">{item.ip}</span>}
                      <StatusDot status={item.status} className="text-xs text-muted" />
                    </div>
                  </button>
                ))
              )}
            </div>

            <Field label="Description (optional)" htmlFor="relation-description">
              <Textarea
                id="relation-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about this relation..."
                className="h-20 resize-none"
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
