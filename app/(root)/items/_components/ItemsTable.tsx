"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Network, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { StatusDot } from "@/components/ui/StatusDot";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import CopyButton from "@/components/CopyButton";
import { TagBadge } from "./TagBadge";
import type { ConfigItem, PaginationData } from "./types";

interface ItemsTableProps {
    items: ConfigItem[];
    selectedIds: string[];
    onToggleSelection: (id: string) => void;
    onToggleAll: () => void;
    onEdit: (item: ConfigItem) => void;
    onRelations: (item: ConfigItem) => void;
    onDelete: (item: ConfigItem) => void;
    pagination: PaginationData;
    paginationRange: (number | string)[];
    onGoToPage: (page: number) => void;
}

export function ItemsTable({
    items,
    selectedIds,
    onToggleSelection,
    onToggleAll,
    onEdit,
    onRelations,
    onDelete,
    pagination,
    paginationRange,
    onGoToPage,
}: ItemsTableProps) {
    const allSelected = selectedIds.length === items.length && items.length > 0;
    const someSelected = selectedIds.length > 0 && !allSelected;

    return (
        <div className="space-y-3">
            <Table>
                <THead>
                    <tr>
                        <TH className="w-10">
                            <Checkbox
                                aria-label="Select all items"
                                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                onCheckedChange={onToggleAll}
                            />
                        </TH>
                        <TH>Name</TH>
                        <TH>Description</TH>
                        <TH>IP</TH>
                        <TH>MAC</TH>
                        <TH>Type</TH>
                        <TH>Status</TH>
                        <TH>Tags</TH>
                        <TH className="relative">
                            <span className="sr-only">Actions</span>
                        </TH>
                    </tr>
                </THead>
                <TBody>
                    {items.map((item) => (
                        <TR key={item.id}>
                            <TD>
                                <Checkbox
                                    aria-label={`Select ${item.name}`}
                                    checked={selectedIds.includes(item.id)}
                                    onCheckedChange={() => onToggleSelection(item.id)}
                                />
                            </TD>
                            <TD mono>
                                <Link
                                    href={`/items/${item.id}`}
                                    title={item.name}
                                    className="block max-w-[13rem] truncate font-medium text-accent hover:underline"
                                >
                                    {item.name}
                                </Link>
                            </TD>
                            <TD>
                                <span className="block max-w-[11rem] truncate text-muted" title={item.description || undefined}>
                                    {item.description}
                                </span>
                            </TD>
                            <TD mono>
                                {item.ip && (
                                    <div className="flex items-center gap-1">
                                        <span className="max-w-[12rem] truncate" title={item.ip}>
                                            {item.ip}
                                        </span>
                                        <CopyButton text={item.ip} />
                                    </div>
                                )}
                            </TD>
                            <TD mono>
                                {item.mac && (
                                    <div className="flex items-center gap-1">
                                        <span className="max-w-[12rem] truncate" title={item.mac}>
                                            {item.mac}
                                        </span>
                                        <CopyButton text={item.mac} />
                                    </div>
                                )}
                            </TD>
                            <TD>
                                {item.itemType ? (
                                    <Badge>{item.itemType.name}</Badge>
                                ) : (
                                    <span className="text-muted">None</span>
                                )}
                            </TD>
                            <TD>
                                <StatusDot status={item.status} />
                            </TD>
                            <TD>
                                <div className="flex max-w-[15rem] min-w-32 flex-wrap gap-1">
                                    {item.tags?.map((tag) => (
                                        <TagBadge key={tag.id} tag={tag} />
                                    ))}
                                    {(!item.tags || item.tags.length === 0) && <span className="text-muted">-</span>}
                                </div>
                            </TD>
                            <TD>
                                <div className="flex items-center gap-0.5">
                                    <IconButton label={`Edit ${item.name}`} icon={Pencil} onClick={() => onEdit(item)} />
                                    <IconButton
                                        label={`Relations of ${item.name}`}
                                        icon={Network}
                                        onClick={() => onRelations(item)}
                                    />
                                    <IconButton
                                        label={`Delete ${item.name}`}
                                        icon={Trash2}
                                        onClick={() => onDelete(item)}
                                    />
                                </div>
                            </TD>
                        </TR>
                    ))}
                </TBody>
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                    Showing <span className="font-mono">{items.length}</span> of{" "}
                    <span className="font-mono">{pagination.total}</span> items
                </p>
                {pagination.totalPages > 1 && (
                    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
                        <span className="mr-2 text-sm text-muted">
                            Page <span className="font-mono">{pagination.page}</span> of{" "}
                            <span className="font-mono">{pagination.totalPages}</span>
                        </span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onGoToPage(pagination.page - 1)}
                            disabled={pagination.page === 1}
                        >
                            <ChevronLeft className="size-4" aria-hidden="true" />
                            Previous
                        </Button>
                        {paginationRange.map((page, idx) =>
                            page === "..." ? (
                                <span key={idx} className="px-2 text-sm text-muted" aria-hidden="true">
                                    ...
                                </span>
                            ) : (
                                <Button
                                    key={idx}
                                    size="sm"
                                    variant={pagination.page === page ? "primary" : "secondary"}
                                    aria-current={pagination.page === page ? "page" : undefined}
                                    onClick={() => onGoToPage(page as number)}
                                    className="font-mono"
                                >
                                    {page}
                                </Button>
                            ),
                        )}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onGoToPage(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                        >
                            Next
                            <ChevronRight className="size-4" aria-hidden="true" />
                        </Button>
                    </nav>
                )}
            </div>
        </div>
    );
}
