"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SkeletonCard } from "@/components/Skeleton";

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

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  DEPRECATED: "bg-red-100 text-red-800",
  MAINTENANCE: "bg-yellow-100 text-yellow-800",
};

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

  if (favorites.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            My Favorites
          </h2>
        </div>
        <div className="text-center py-6 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p className="text-sm">No favorites yet</p>
          <p className="text-xs mt-1">Star items to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          My Favorites
        </h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {favorites.map((favorite) => (
          <Link
            key={favorite.id}
            href={`/items/${favorite.configurationItem.id}`}
            className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {favorite.configurationItem.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      statusColors[favorite.configurationItem.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {favorite.configurationItem.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {favorite.configurationItem.itemType && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {favorite.configurationItem.itemType.name}
                    </span>
                  )}
                  {favorite.configurationItem.tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      {favorite.configurationItem.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor: tag.color ? `${tag.color}30` : "#e5e7eb",
                            color: tag.color || "#374151",
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {favorite.configurationItem.tags.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{favorite.configurationItem.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
