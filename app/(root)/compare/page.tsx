'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/Skeleton';
import Link from 'next/link';

interface ConfigItem {
  id: string;
  name: string;
  description?: string | null;
  ip?: string | null;
  mac?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  itemType?: { id: string; name: string } | null;
  tags: { id: string; name: string; color?: string | null }[];
  customFieldValues: {
    id: string;
    value: string;
    customField: {
      id: string;
      name: string;
      label: string;
      type: string;
    };
  }[];
  relationsFrom: {
    id: string;
    type: string;
    description?: string | null;
    target: { id: string; name: string };
  }[];
  relationsTo: {
    id: string;
    type: string;
    description?: string | null;
    source: { id: string; name: string };
  }[];
  maintenanceSchedules: {
    id: string;
    title: string;
    scheduledDate: string;
    status: string;
    priority: string;
  }[];
}

interface AvailableItem {
  id: string;
  name: string;
  itemType?: { name: string } | null;
  status: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  DEPRECATED: 'bg-red-100 text-red-800 border-red-200',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

export default function ComparePage() {
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [highlightDifferences, setHighlightDifferences] = useState(true);

  useEffect(() => {
    fetchAvailableItems();
  }, []);

  useEffect(() => {
    if (selectedIds.length > 0) {
      fetchItems();
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const fetchAvailableItems = async () => {
    try {
      const res = await fetch('/api/configuration-items?limit=1000');
      if (res.ok) {
        const data = await res.json();
        setAvailableItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const fetchedItems: ConfigItem[] = [];
      
      for (const id of selectedIds) {
        const res = await fetch(`/api/configuration-items/${id}`);
        if (res.ok) {
          const data = await res.json();
          fetchedItems.push(data);
        }
      }
      
      setItems(fetchedItems);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      }
      if (prev.length >= 4) {
        return prev; // Max 4 items for comparison
      }
      return [...prev, id];
    });
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setItems([]);
  };

  const removeItem = (id: string) => {
    setSelectedIds(prev => prev.filter(itemId => itemId !== id));
  };

  // Helper to compare values across all items
  const getFieldValues = (fieldGetter: (item: ConfigItem) => unknown) => {
    return items.map(item => fieldGetter(item));
  };

  const areValuesEqual = (values: unknown[]) => {
    if (values.length <= 1) return true;
    const first = JSON.stringify(values[0]);
    return values.every(v => JSON.stringify(v) === first);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value || '-';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) {
      if (value.length === 0) return '-';
      return value.map(v => typeof v === 'object' && v !== null ? (v as {name?: string}).name || JSON.stringify(v) : String(v)).join(', ');
    }
    if (typeof value === 'object') {
      return (value as {name?: string}).name || JSON.stringify(value);
    }
    return String(value);
  };

  const filteredItems = availableItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.itemType?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedItemsList = availableItems.filter(item => selectedIds.includes(item.id));

  // Comparison fields configuration
  const basicFields = [
    { key: 'name', label: 'Name', getter: (item: ConfigItem) => item.name },
    { key: 'description', label: 'Description', getter: (item: ConfigItem) => item.description },
    { key: 'status', label: 'Status', getter: (item: ConfigItem) => item.status },
    { key: 'ip', label: 'IP Address', getter: (item: ConfigItem) => item.ip },
    { key: 'mac', label: 'MAC Address', getter: (item: ConfigItem) => item.mac },
    { key: 'itemType', label: 'Type', getter: (item: ConfigItem) => item.itemType?.name || '-' },
    { key: 'tags', label: 'Tags', getter: (item: ConfigItem) => (item.tags || []).map(t => t.name) },
    { key: 'createdAt', label: 'Created', getter: (item: ConfigItem) => new Date(item.createdAt).toLocaleDateString() },
    { key: 'updatedAt', label: 'Last Updated', getter: (item: ConfigItem) => new Date(item.updatedAt).toLocaleDateString() },
  ];

  // Collect all custom fields from all items
  const allCustomFields = Array.from(new Set(
    items.flatMap(item => 
      item.customFieldValues?.map(cfv => cfv.customField?.name).filter(Boolean) || []
    )
  ));

  const customFieldConfigs = allCustomFields.map(fieldName => ({
    key: `custom_${fieldName}`,
    label: fieldName,
    getter: (item: ConfigItem) => {
      const cfv = item.customFieldValues?.find(v => v.customField?.name === fieldName);
      return cfv?.value ?? '-';
    },
  }));

  const allFields = [...basicFields, ...customFieldConfigs];

  // Filter fields if showDiffOnly is enabled
  const visibleFields = showDiffOnly
    ? allFields.filter(field => !areValuesEqual(getFieldValues(field.getter)))
    : allFields;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Compare Assets</h1>
            <p className="text-gray-600 mt-1">
              Side-by-side comparison of configuration items
            </p>
          </div>
          {selectedIds.length > 0 && (
            <Button onClick={clearSelection} variant="outline">
              Clear Selection
            </Button>
          )}
        </div>

        {/* Selection Section */}
        {selectedIds.length < 2 && (
          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Select Assets to Compare
            </h2>
            <p className="text-gray-600 mb-4">
              Choose 2-4 assets to compare their properties side-by-side.
            </p>

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-96 border rounded-lg p-2"
              />
            </div>

            {/* Selected Items Preview */}
            {selectedIds.length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-2">
                  Selected ({selectedIds.length}/4):
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedItemsList.map(item => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {item.name}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-blue-600 hover:text-blue-800 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Available Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {filteredItems.map(item => {
                const isSelected = selectedIds.includes(item.id);
                const isMaxSelected = selectedIds.length >= 4 && !isSelected;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => !isMaxSelected && toggleSelection(item.id)}
                    disabled={isMaxSelected}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : isMaxSelected
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.itemType?.name || 'No Type'}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          statusColors[item.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="mt-2 text-blue-600 text-sm font-medium">
                        ✓ Selected for comparison
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Comparison View */}
        {selectedIds.length >= 2 && items.length > 0 && (
          <>
            {/* Controls */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showDiffOnly}
                    onChange={(e) => setShowDiffOnly(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Show differences only</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={highlightDifferences}
                    onChange={(e) => setHighlightDifferences(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Highlight differences</span>
                </label>
                <div className="ml-auto flex gap-2">
                  {selectedItemsList.map(item => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                    >
                      {item.name}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-500 hover:text-red-600 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <Button onClick={clearSelection} variant="outline" size="sm">
                    Change Selection
                  </Button>
                </div>
              </div>
            </div>

            {/* Comparison Table */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {selectedIds.map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 w-48 sticky left-0 bg-gray-50 z-10">
                          Property
                        </th>
                        {items.map(item => (
                          <th
                            key={item.id}
                            className="py-3 px-4 text-left text-sm font-medium text-gray-800 min-w-[200px]"
                          >
                            <Link
                              href={`/items/${item.id}`}
                              className="text-brand-primary hover:underline"
                            >
                              {item.name}
                            </Link>
                            <span
                              className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                statusColors[item.status] || 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {visibleFields.map((field, idx) => {
                        const values = getFieldValues(field.getter);
                        const isEqual = areValuesEqual(values);
                        const rowClass = !isEqual && highlightDifferences
                          ? 'bg-yellow-50'
                          : idx % 2 === 0
                          ? 'bg-white'
                          : 'bg-gray-50/50';

                        return (
                          <tr key={field.key} className={rowClass}>
                            <td className="py-3 px-4 text-sm font-medium text-gray-700 sticky left-0 bg-inherit z-10">
                              <div className="flex items-center gap-2">
                                {field.label}
                                {!isEqual && (
                                  <span className="px-1.5 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded">
                                    diff
                                  </span>
                                )}
                              </div>
                            </td>
                            {items.map((item, itemIdx) => {
                              const value = values[itemIdx];
                              const formattedValue = formatValue(value);
                              const isDifferent = !isEqual && highlightDifferences;

                              return (
                                <td
                                  key={item.id}
                                  className={`py-3 px-4 text-sm ${
                                    isDifferent ? 'font-medium text-gray-900' : 'text-gray-600'
                                  }`}
                                >
                                  {field.key === 'status' ? (
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                        statusColors[value as string] || 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {formattedValue}
                                    </span>
                                  ) : field.key === 'tags' ? (
                                    <div className="flex flex-wrap gap-1">
                                      {(value as string[]).map((tagName, i) => {
                                        const tag = item.tags.find(t => t.name === tagName);
                                        return (
                                          <span
                                            key={i}
                                            className="px-2 py-0.5 rounded text-xs"
                                            style={{
                                              backgroundColor: tag?.color ? `${tag.color}30` : '#e5e7eb',
                                              border: `1px solid ${tag?.color || '#d1d5db'}`,
                                              color: tag?.color || '#374151',
                                            }}
                                          >
                                            {tagName}
                                          </span>
                                        );
                                      })}
                                      {(value as string[]).length === 0 && '-'}
                                    </div>
                                  ) : (
                                    formattedValue
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {visibleFields.length === 0 && showDiffOnly && (
                  <div className="p-12 text-center text-gray-500">
                    <svg
                      className="w-16 h-16 mx-auto mb-4 text-green-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">
                      All Properties Match!
                    </h3>
                    <p className="text-sm">
                      The selected assets have identical values for all comparable properties.
                    </p>
                    <Button
                      onClick={() => setShowDiffOnly(false)}
                      variant="outline"
                      className="mt-4"
                    >
                      Show All Properties
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Relations Comparison */}
            {items.length > 0 && (
              <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Relations Comparison
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {items.map(item => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <h3 className="font-medium text-gray-800 mb-2">{item.name}</h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">
                            Outgoing ({item.relationsFrom.length})
                          </p>
                          {item.relationsFrom.length === 0 ? (
                            <p className="text-sm text-gray-400">-</p>
                          ) : (
                            <ul className="text-sm space-y-1">
                              {item.relationsFrom.map(rel => (
                                <li key={rel.id} className="text-gray-600">
                                  {rel.type} →{' '}
                                  <Link
                                    href={`/items/${rel.target.id}`}
                                    className="text-brand-primary hover:underline"
                                  >
                                    {rel.target.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">
                            Incoming ({item.relationsTo.length})
                          </p>
                          {item.relationsTo.length === 0 ? (
                            <p className="text-sm text-gray-400">-</p>
                          ) : (
                            <ul className="text-sm space-y-1">
                              {item.relationsTo.map(rel => (
                                <li key={rel.id} className="text-gray-600">
                                  ← {rel.type} {' '}
                                  <Link
                                    href={`/items/${rel.source.id}`}
                                    className="text-brand-primary hover:underline"
                                  >
                                    {rel.source.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Maintenance Comparison */}
            {items.some(i => i.maintenanceSchedules.length > 0) && (
              <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Maintenance Schedules
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {items.map(item => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <h3 className="font-medium text-gray-800 mb-2">{item.name}</h3>
                      {item.maintenanceSchedules.length === 0 ? (
                        <p className="text-sm text-gray-400">No maintenance scheduled</p>
                      ) : (
                        <ul className="space-y-2">
                          {item.maintenanceSchedules.map(schedule => (
                            <li key={schedule.id} className="text-sm">
                              <p className="font-medium">{schedule.title}</p>
                              <p className="text-gray-500">
                                {new Date(schedule.scheduledDate).toLocaleDateString()}
                              </p>
                              <span
                                className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                                  schedule.status === 'COMPLETED'
                                    ? 'bg-green-100 text-green-800'
                                    : schedule.status === 'SCHEDULED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {schedule.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {selectedIds.length === 0 && (
          <div className="bg-white p-12 rounded-lg shadow-sm text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              Compare Configuration Items
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Select 2-4 assets from your inventory to compare their properties,
              relations, and maintenance schedules side-by-side.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
