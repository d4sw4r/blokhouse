'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, Columns3, SearchX, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatusDot } from '@/components/ui/StatusDot';
import { SkeletonCard } from '@/components/Skeleton';
import { TagBadge } from '@/components/TagBadge';
import { cn } from '@/lib/utils';

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
  customFields: {
    id: string;
    name: string;
    label: string;
    type: string;
    value: string;
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
  const basicFields: { key: string; label: string; mono?: boolean; getter: (item: ConfigItem) => unknown }[] = [
    { key: 'name', label: 'Name', mono: true, getter: (item: ConfigItem) => item.name },
    { key: 'description', label: 'Description', getter: (item: ConfigItem) => item.description },
    { key: 'status', label: 'Status', getter: (item: ConfigItem) => item.status },
    { key: 'ip', label: 'IP Address', mono: true, getter: (item: ConfigItem) => item.ip },
    { key: 'mac', label: 'MAC Address', mono: true, getter: (item: ConfigItem) => item.mac },
    { key: 'itemType', label: 'Type', getter: (item: ConfigItem) => item.itemType?.name || '-' },
    { key: 'tags', label: 'Tags', getter: (item: ConfigItem) => (item.tags || []).map(t => t.name) },
    { key: 'createdAt', label: 'Created', getter: (item: ConfigItem) => new Date(item.createdAt).toLocaleDateString() },
    { key: 'updatedAt', label: 'Last Updated', getter: (item: ConfigItem) => new Date(item.updatedAt).toLocaleDateString() },
  ];

  // Collect all custom fields from all items
  const allCustomFields = Array.from(new Set(
    items.flatMap(item => 
      item.customFields?.map(cf => cf.name).filter(Boolean) || []
    )
  ));

  const customFieldConfigs = allCustomFields.map(fieldName => ({
    key: `custom_${fieldName}`,
    label: fieldName,
    mono: false,
    getter: (item: ConfigItem) => {
      const cf = item.customFields?.find(f => f.name === fieldName);
      return cf?.value ?? '-';
    },
  }));

  const allFields = [...basicFields, ...customFieldConfigs];

  // Filter fields if showDiffOnly is enabled
  const visibleFields = showDiffOnly
    ? allFields.filter(field => !areValuesEqual(getFieldValues(field.getter)))
    : allFields;

  const chip = (item: AvailableItem) => (
    <span
      key={item.id}
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-surface-2 py-0.5 pl-2 text-sm text-text"
    >
      <span className="truncate font-mono text-[13px]" title={item.name}>
        {item.name}
      </span>
      <button
        type="button"
        onClick={() => removeItem(item.id)}
        aria-label={`Remove ${item.name}`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:text-text max-sm:size-11"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </span>
  );

  return (
    <div>
      <PageHeader
        title="Compare Assets"
        description="Side-by-side comparison of configuration items"
        actions={
          selectedIds.length > 0 ? (
            <Button onClick={clearSelection} variant="secondary">
              Clear Selection
            </Button>
          ) : undefined
        }
      />

      {/* Selection Section */}
      {selectedIds.length < 2 && (
        <Panel title="Select Assets to Compare" className="mb-6">
          <p className="mb-4 text-sm text-muted">
            Choose 2-4 assets to compare their properties side-by-side.
          </p>

          <div className="mb-4 md:w-96">
            <Input
              type="text"
              aria-label="Search assets"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {selectedIds.length > 0 && (
            <div className="mb-4 rounded-lg border border-border bg-surface-2 p-3">
              <p className="mb-2 text-sm font-medium text-text">
                Selected ({selectedIds.length}/4):
              </p>
              <div className="flex flex-wrap gap-2">{selectedItemsList.map(chip)}</div>
            </div>
          )}

          {filteredItems.length === 0 && availableItems.length > 0 ? (
            <EmptyState icon={SearchX} title="No matching assets" description="Try a different search term." />
          ) : (
            <div className="grid max-h-96 grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map(item => {
                const isSelected = selectedIds.includes(item.id);
                const isMaxSelected = selectedIds.length >= 4 && !isSelected;

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => !isMaxSelected && toggleSelection(item.id)}
                    disabled={isMaxSelected}
                    aria-pressed={isSelected}
                    className={cn(
                      'min-w-0 rounded-lg border p-3 text-left transition-colors duration-150 motion-reduce:transition-none max-sm:min-h-11',
                      isSelected
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-surface hover:bg-surface-2',
                      isMaxSelected && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[13px] font-medium text-text" title={item.name}>
                          {item.name}
                        </p>
                        <p className="truncate text-sm text-muted">{item.itemType?.name || 'No Type'}</p>
                      </div>
                      <StatusDot status={item.status} className="shrink-0" />
                    </div>
                    {isSelected && (
                      <div className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent">
                        <Check className="size-4" aria-hidden="true" />
                        Selected for comparison
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* Comparison View */}
      {selectedIds.length >= 2 && items.length > 0 && (
        <>
          {/* Controls */}
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-border bg-surface p-3">
            <label className="flex items-center gap-2 text-sm text-text max-sm:min-h-11">
              <Checkbox
                checked={showDiffOnly}
                onCheckedChange={(v) => setShowDiffOnly(v === true)}
              />
              Show differences only
            </label>
            <label className="flex items-center gap-2 text-sm text-text max-sm:min-h-11">
              <Checkbox
                checked={highlightDifferences}
                onCheckedChange={(v) => setHighlightDifferences(v === true)}
              />
              Highlight differences
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-2 md:ml-auto">
              {selectedItemsList.map(chip)}
              <Button onClick={clearSelection} variant="secondary" size="sm">
                Change Selection
              </Button>
            </div>
          </div>

          {/* Comparison Table */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {selectedIds.map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-surface-2">
                    <tr>
                      <th
                        scope="col"
                        className="sticky left-0 z-10 w-40 bg-surface-2 px-3 py-2 text-left text-xs font-medium text-muted sm:w-48"
                      >
                        Property
                      </th>
                      {items.map(item => (
                        <th
                          key={item.id}
                          scope="col"
                          className="min-w-[200px] px-3 py-2 text-left align-top"
                        >
                          <Link
                            href={`/items/${item.id}`}
                            className="block break-all font-mono text-[13px] font-medium text-accent hover:underline"
                          >
                            {item.name}
                          </Link>
                          <StatusDot status={item.status} className="mt-1 text-xs font-normal" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleFields.map(field => {
                      const values = getFieldValues(field.getter);
                      const isEqual = areValuesEqual(values);
                      const marked = !isEqual && highlightDifferences;

                      return (
                        <tr key={field.key}>
                          <th
                            scope="row"
                            className="sticky left-0 z-10 bg-surface p-0 text-left align-top font-medium text-text"
                          >
                            <div className={cn('flex flex-wrap items-center gap-2 px-3 py-2', marked && 'bg-warning/10')}>
                              {field.label}
                              {!isEqual && <Badge tone="warning">diff</Badge>}
                            </div>
                          </th>
                          {items.map((item, itemIdx) => {
                            const value = values[itemIdx];
                            const formattedValue = formatValue(value);

                            return (
                              <td
                                key={item.id}
                                className={cn(
                                  'px-3 py-2 align-top break-words',
                                  marked ? 'bg-warning/10 font-medium text-text' : 'text-text',
                                  field.mono && 'break-all font-mono text-[13px]',
                                )}
                              >
                                {field.key === 'status' ? (
                                  <StatusDot status={value as string} />
                                ) : field.key === 'tags' ? (
                                  <div className="flex flex-wrap gap-1">
                                    {(value as string[]).map((tagName, i) => {
                                      const tag = item.tags.find(t => t.name === tagName);
                                      return (
                                        <TagBadge
                                          key={i}
                                          tag={tag ?? { id: tagName, name: tagName }}
                                        />
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
                <div className="p-6">
                  <EmptyState
                    icon={Check}
                    title="All Properties Match!"
                    description="The selected assets have identical values for all comparable properties."
                    action={
                      <Button onClick={() => setShowDiffOnly(false)} variant="secondary">
                        Show All Properties
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* Relations Comparison */}
          {items.length > 0 && (
            <Panel title="Relations Comparison" className="mt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {items.map(item => (
                  <div key={item.id} className="min-w-0 rounded-lg border border-border p-3">
                    <h3 className="mb-2 break-all font-mono text-[13px] font-medium text-text">{item.name}</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted">
                          Outgoing ({item.relationsFrom.length})
                        </p>
                        {item.relationsFrom.length === 0 ? (
                          <p className="text-sm text-muted">-</p>
                        ) : (
                          <ul className="mt-1 space-y-1 text-sm">
                            {item.relationsFrom.map(rel => (
                              <li key={rel.id} className="break-words text-text">
                                {rel.type} →{' '}
                                <Link
                                  href={`/items/${rel.target.id}`}
                                  className="break-all font-mono text-[13px] text-accent hover:underline"
                                >
                                  {rel.target.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted">
                          Incoming ({item.relationsTo.length})
                        </p>
                        {item.relationsTo.length === 0 ? (
                          <p className="text-sm text-muted">-</p>
                        ) : (
                          <ul className="mt-1 space-y-1 text-sm">
                            {item.relationsTo.map(rel => (
                              <li key={rel.id} className="break-words text-text">
                                ← {rel.type}{' '}
                                <Link
                                  href={`/items/${rel.source.id}`}
                                  className="break-all font-mono text-[13px] text-accent hover:underline"
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
            </Panel>
          )}

          {/* Maintenance Comparison */}
          {items.some(i => i.maintenanceSchedules.length > 0) && (
            <Panel title="Maintenance Schedules" className="mt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {items.map(item => (
                  <div key={item.id} className="min-w-0 rounded-lg border border-border p-3">
                    <h3 className="mb-2 break-all font-mono text-[13px] font-medium text-text">{item.name}</h3>
                    {item.maintenanceSchedules.length === 0 ? (
                      <p className="text-sm text-muted">No maintenance scheduled</p>
                    ) : (
                      <ul className="space-y-3">
                        {item.maintenanceSchedules.map(schedule => (
                          <li key={schedule.id} className="text-sm">
                            <p className="break-words font-medium text-text">{schedule.title}</p>
                            <p className="font-mono text-[13px] text-muted">
                              {new Date(schedule.scheduledDate).toLocaleDateString()}
                            </p>
                            <Badge
                              className="mt-1"
                              tone={
                                schedule.status === 'COMPLETED'
                                  ? 'success'
                                  : schedule.status === 'SCHEDULED'
                                  ? 'accent'
                                  : 'warning'
                              }
                            >
                              {schedule.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}

      {/* Empty State */}
      {selectedIds.length === 0 && (
        <EmptyState
          icon={Columns3}
          title="Compare Configuration Items"
          description="Select 2-4 assets from your inventory to compare their properties, relations, and maintenance schedules side-by-side."
        />
      )}
    </div>
  );
}
