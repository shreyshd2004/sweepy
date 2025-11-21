'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/auth';
import { getCatalogWithUserStatus, getMaterialRecordings } from '@/lib/firestore-catalog';
import { getImageDownloadURL } from '@/lib/storage';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaterialDatabaseDrawer } from '@/components/MaterialDatabaseDrawer';
import { Search, Filter, CheckCircle2, Circle, Trophy, Users } from 'lucide-react';
import type { MaterialCatalogDocument, MaterialStats, UserDiscovery, MaterialDocument } from '@/lib/zodSchemas';

type CatalogItem = MaterialCatalogDocument & { 
  isDiscovered: boolean; 
  stats: MaterialStats | null; 
  userDiscovery?: UserDiscovery;
};

export default function DatabasePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [filteredCatalog, setFilteredCatalog] = useState<CatalogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'discovered' | 'undiscovered'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<CatalogItem | null>(null);
  const [selectedRecordings, setSelectedRecordings] = useState<MaterialDocument[]>([]);
  const [showRecordings, setShowRecordings] = useState(false);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
      
      if (!user) {
        router.push('/');
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (user) {
      loadCatalog();
    }
  }, [user]);

  useEffect(() => {
    // Load image URLs for catalog items
    const loadImageUrls = async () => {
      const urls = new Map<string, string>();
      for (const item of catalog) {
        if (item.defaultImagePath) {
          try {
            const url = await getImageDownloadURL(item.defaultImagePath);
            urls.set(item.id, url);
          } catch (error) {
            console.error(`Error loading image for ${item.id}:`, error);
          }
        }
      }
      setImageUrls(urls);
    };

    if (catalog.length > 0) {
      loadImageUrls();
    }
  }, [catalog]);

  const loadCatalog = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getCatalogWithUserStatus(user.uid);
      setCatalog(data);
      setFilteredCatalog(data);
    } catch (error) {
      console.error('Error loading catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...catalog];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (filterStatus === 'discovered') {
      filtered = filtered.filter((item) => item.isDiscovered);
    } else if (filterStatus === 'undiscovered') {
      filtered = filtered.filter((item) => !item.isDiscovered);
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === filterCategory);
    }

    setFilteredCatalog(filtered);
  }, [catalog, searchTerm, filterStatus, filterCategory]);

  const handleMaterialClick = async (material: CatalogItem) => {
    setSelectedMaterial(material);
    try {
      const recordings = await getMaterialRecordings(material.id);
      setSelectedRecordings(recordings);
      setShowRecordings(true);
    } catch (error) {
      console.error('Error loading recordings:', error);
      setSelectedRecordings([]);
      setShowRecordings(true);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-700';
      case 'uncommon': return 'bg-green-100 text-green-700';
      case 'rare': return 'bg-blue-100 text-blue-700';
      case 'epic': return 'bg-purple-100 text-purple-700';
      case 'legendary': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRarityIcon = (rarity: string) => {
    if (rarity === 'legendary' || rarity === 'epic') {
      return <Trophy className="w-3 h-3" />;
    }
    return null;
  };

  const discoveredCount = catalog.filter((item) => item.isDiscovered).length;
  const totalCount = catalog.length;
  const categories = Array.from(new Set(catalog.map((item) => item.category)));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-900">Material Database</h1>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-green-600">{discoveredCount}</span>
            <span className="text-gray-400">/</span>
            <span>{totalCount}</span>
            <span className="text-gray-500 ml-1">discovered</span>
          </div>
          {totalCount > 0 && (
            <div className="text-xs text-gray-500 ml-2">
              {Math.round((discoveredCount / totalCount) * 100)}% complete
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
            className="text-xs"
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'discovered' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('discovered')}
            className="text-xs"
          >
            Discovered
          </Button>
          <Button
            variant={filterStatus === 'undiscovered' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('undiscovered')}
            className="text-xs"
          >
            Undiscovered
          </Button>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="px-4 py-4">
        {filteredCatalog.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No materials found.</p>
            {catalog.length === 0 && (
              <p className="text-sm mt-2">Start discovering materials to build your collection!</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredCatalog.map((item) => (
              <button
                key={item.id}
                onClick={() => handleMaterialClick(item)}
                className={`relative bg-white border-2 rounded-xl p-3 transition-all ${
                  item.isDiscovered
                    ? 'border-green-200 hover:border-green-300'
                    : 'border-gray-200 hover:border-gray-300 opacity-60'
                }`}
              >
                {/* Discovery Status */}
                <div className="absolute top-2 right-2">
                  {item.isDiscovered ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {/* Material Image */}
                <div className={`w-full aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden ${!item.isDiscovered ? 'grayscale opacity-50' : ''}`}>
                  {imageUrls.get(item.id) ? (
                    <img
                      src={imageUrls.get(item.id)}
                      alt={item.materialName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : item.defaultImagePath ? (
                    <img
                      src={item.defaultImagePath}
                      alt={item.materialName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-gray-400 text-4xl">?</div>
                  )}
                </div>

                {/* Material Info */}
                <div className="text-left">
                  <h3 className={`font-semibold text-sm mb-1 ${item.isDiscovered ? 'text-gray-900' : 'text-gray-500'}`}>
                    {item.materialName}
                  </h3>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-gray-500">{item.category}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getRarityColor(item.rarity)}`}>
                      {getRarityIcon(item.rarity)}
                      <span className="ml-1 capitalize">{item.rarity}</span>
                    </span>
                  </div>
                  {item.stats && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Users className="w-3 h-3" />
                      <span>{item.stats.totalDiscoveries} users</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Material Detail Drawer */}
      {selectedMaterial && showRecordings && (
        <MaterialDatabaseDrawer
          material={{
            id: selectedMaterial.id,
            materialName: selectedMaterial.materialName,
            howToRecycle: selectedMaterial.recyclingInstructions,
            discoveredAt: selectedMaterial.userDiscovery?.discoveredAt || new Date(),
            imagePath: selectedMaterial.defaultImagePath,
            audioPath: selectedRecordings[0]?.audioPath,
            frequencyData: selectedRecordings[0]?.frequencyData,
          }}
          isOpen={showRecordings}
          onClose={() => {
            setShowRecordings(false);
            setSelectedMaterial(null);
            setSelectedRecordings([]);
          }}
          communityRecordings={selectedRecordings}
          stats={selectedMaterial.stats}
          isDiscovered={selectedMaterial.isDiscovered}
        />
      )}

      <BottomNavigation />
    </div>
  );
}

