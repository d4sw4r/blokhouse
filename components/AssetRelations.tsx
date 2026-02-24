'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

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

const relationTypes = [
  { value: "DEPENDS_ON", label: "Depends On", icon: "🔗" },
  { value: "RUNS_ON", label: "Runs On", icon: "🖥️" },
  { value: "CONNECTED_TO", label: "Connected To", icon: "🔌" },
  { value: "CONTAINS", label: "Contains", icon: "📦" },
  { value: "PART_OF", label: "Part Of", icon: "🧩" },
  { value: "MANAGES", label: "Manages", icon: "⚙️" },
];

const relationColors: Record<string, string> = {
  DEPENDS_ON: "bg-red-100 text-red-800 border-red-300",
  RUNS_ON: "bg-blue-100 text-blue-800 border-blue-300",
  CONNECTED_TO: "bg-green-100 text-green-800 border-green-300",
  CONTAINS: "bg-purple-100 text-purple-800 border-purple-300",
  PART_OF: "bg-yellow-100 text-yellow-800 border-yellow-300",
  MANAGES: "bg-orange-100 text-orange-800 border-orange-300",
};

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
  }, [itemId]);

  useEffect(() => {
    if (showAddModal) {
      fetchAvailableItems();
    }
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

  const getRelationTypeIcon = (type: string) => {
    return relationTypes.find((t) => t.value === type)?.icon || "🔗";
  };

  const getRelationColorClass = (type: string) => {
    return relationColors[type] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const displayedRelations = relations
    ? activeTab === "all"
      ? relations.all
      : relations[activeTab]
    : [];

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-700">Asset Relations</h3>
          <p className="text-sm text-gray-500">
            Define relationships between this asset and others
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>+ Add Relation</Button>
      </div>

      {/* Tabs */}
      {relations && (relations.outgoing.length > 0 || relations.incoming.length > 0) && (
        <div className="flex gap-2 mb-4 border-b">
          {[
            { key: "all", label: `All (${relations.all.length})` },
            { key: "outgoing", label: `Outgoing (${relations.outgoing.length})` },
            { key: "incoming", label: `Incoming (${relations.incoming.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Relations List */}
      {loading ? (
        <div className="py-8 text-center text-gray-500">Loading relations...</div>
      ) : displayedRelations.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          {relations?.all.length === 0
            ? "No relations defined yet. Add a relation to connect this asset with others."
            : "No relations in this category."}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedRelations.map((relation) => (
            <div
              key={relation.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-lg">{getRelationTypeIcon(relation.type)}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {relation.direction === "outgoing" ? (
                      <>
                        <span className="font-medium text-gray-900">{itemName}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRelationColorClass(
                            relation.type
                          )}`}
                        >
                          {getRelationTypeLabel(relation.type)}
                        </span>
                        <span className="font-medium text-gray-900">
                          {relation.target.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-gray-900">
                          {relation.target.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRelationColorClass(
                            relation.type
                          )}`}
                        >
                          {getRelationTypeLabel(relation.type)}
                        </span>
                        <span className="font-medium text-gray-900">{itemName}</span>
                      </>
                    )}
                  </div>
                  {relation.description && (
                    <p className="text-sm text-gray-500 mt-1">{relation.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{relation.target.itemType?.name || "No Type"}</span>
                    {relation.target.ip && <span>• {relation.target.ip}</span>}
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        relation.target.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : relation.target.status === "MAINTENANCE"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {relation.target.status}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => deleteRelation(relation.id)}
                variant="destructive"
                className="text-sm"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Relation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Add New Relation</h3>

            {/* Relation Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Relation Type *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {relationTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedType === type.value
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-lg mr-2">{type.icon}</span>
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {itemName} {" "}
                <span className="font-medium text-gray-700">
                  {getRelationTypeLabel(selectedType).toLowerCase()}
                </span>{" "}
                the selected asset
              </p>
            </div>

            {/* Target Asset Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Target Asset *
              </label>
              <input
                type="text"
                placeholder="Search assets by name or IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border rounded-sm p-2 mb-2"
              />
              <div className="max-h-48 overflow-y-auto border rounded-sm">
                {availableItems.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {searchQuery
                      ? "No matching assets found"
                      : "Type to search for assets"}
                  </div>
                ) : (
                  availableItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedTarget(item.id)}
                      className={`w-full text-left p-3 border-b last:border-b-0 transition-colors ${
                        selectedTarget === item.id
                          ? "bg-blue-50 border-blue-500"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{item.name}</span>
                        {selectedTarget === item.id && (
                          <span className="text-blue-600">✓</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {item.itemType?.name || "No Type"}
                        {item.ip && ` • ${item.ip}`}
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded ${
                            item.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : item.status === "MAINTENANCE"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about this relation..."
                className="w-full border rounded-sm p-2 h-20 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={createRelation}
                disabled={!selectedTarget}
              >
                Create Relation
              </Button>
              <Button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedTarget("");
                  setDescription("");
                  setSearchQuery("");
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
