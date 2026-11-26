"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { SkeletonCard } from "@/components/Skeleton";
import { Panel } from "@/components/ui/Panel";
import { StatusDot } from "@/components/ui/StatusDot";

interface FavoriteItem {
  id: string;
  configurationItem: {
    id: string;
    name: string;
    status: string;
    itemType?: { name: string } | null;
    tags: { id: string; name: string; color?: string | null }[];
  };
  createdAt: string;
}

export default function FavoritesWidget() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const res = await fetch("/api/favorites");
        if (res.ok) {
          const data = await res.json();
          setFavorites(data.slice(0, 5)); // Show only first 5
        }
      } catch (error) {
        console.error("Failed to fetch favorites:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  if (loading) {
    return <SkeletonCard />;
  }

  const title = (
    <span className="flex items-center gap-2">
      <Star className="size-4 text-warning" aria-hidden="true" />
      My favorites
    </span>
  );

  if (favorites.length === 0) {
    return (
      <Panel title={title}>
        <div className="py-4 text-center text-sm text-muted">
          <p>No favorites yet</p>
          <p className="mt-1 text-xs">Star items to see them here</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={title} padded={false}>
      <div className="divide-y divide-border">
        {favorites.map((favorite) => (
          <Link
            key={favorite.id}
            href={`/items/${favorite.configurationItem.id}`}
            className="flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span
                  className="truncate font-mono text-sm font-medium text-text"
                  title={favorite.configurationItem.name}
                >
                  {favorite.configurationItem.name}
                </span>
                <StatusDot status={favorite.configurationItem.status} className="shrink-0 text-xs" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                {favorite.configurationItem.itemType && <span>{favorite.configurationItem.itemType.name}</span>}
                {favorite.configurationItem.tags.slice(0, 3).map((tag) => (
                  <span key={tag.id} className="rounded border border-border px-1.5 py-0.5 text-text">
                    {tag.name}
                  </span>
                ))}
                {favorite.configurationItem.tags.length > 3 && <span>+{favorite.configurationItem.tags.length - 3}</span>}
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}
