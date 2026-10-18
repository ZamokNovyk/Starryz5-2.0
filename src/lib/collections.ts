import { supabase } from './supabase';

export interface Collection {
  id: string;
  name: string;
  created_at?: string;
  firebase_uid: string;
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  firebase_uid: string;
  item_id: string;
  item_type: 'professor' | 'center' | 'student';
  item_name: string;
  item_image: string | null;
  item_subtitle: string | null;
  created_at?: string;
}

// Helper to determine if we should fallback to localStorage (e.g., if Supabase table is not found)
let useLocalStorageFallback = false;

const LOCAL_STORAGE_COLLECTIONS_KEY = 'starryz_local_collections';
const LOCAL_STORAGE_ITEMS_KEY = 'starryz_local_collection_items';

// Local storage helpers
function getLocalCollections(uid: string): Collection[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(LOCAL_STORAGE_COLLECTIONS_KEY);
  if (!raw) {
    // Create default 'Guardados' collection if empty
    const defaultCol: Collection = {
      id: 'default-guardados-id',
      name: 'Guardados',
      firebase_uid: uid,
    };
    localStorage.setItem(LOCAL_STORAGE_COLLECTIONS_KEY, JSON.stringify([defaultCol]));
    return [defaultCol];
  }
  try {
    const list = JSON.parse(raw) as Collection[];
    const userCols = list.filter(c => c.firebase_uid === uid);
    if (userCols.length === 0) {
      const defaultCol: Collection = {
        id: `default-guardados-${uid}`,
        name: 'Guardados',
        firebase_uid: uid,
      };
      list.push(defaultCol);
      localStorage.setItem(LOCAL_STORAGE_COLLECTIONS_KEY, JSON.stringify(list));
      return [defaultCol];
    }
    return userCols;
  } catch (e) {
    return [];
  }
}

function saveLocalCollection(uid: string, name: string): Collection {
  const collections = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(LOCAL_STORAGE_COLLECTIONS_KEY) || '[]') as Collection[] : [];
  const newCol: Collection = {
    id: `col-${Math.random().toString(36).substring(2, 11)}`,
    name,
    firebase_uid: uid,
  };
  collections.push(newCol);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_COLLECTIONS_KEY, JSON.stringify(collections));
  }
  return newCol;
}

function deleteLocalCollection(uid: string, colId: string) {
  if (typeof window === 'undefined') return;
  const collections = JSON.parse(localStorage.getItem(LOCAL_STORAGE_COLLECTIONS_KEY) || '[]') as Collection[];
  const filteredCols = collections.filter(c => !(c.id === colId && c.firebase_uid === uid));
  localStorage.setItem(LOCAL_STORAGE_COLLECTIONS_KEY, JSON.stringify(filteredCols));

  const items = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY) || '[]') as CollectionItem[];
  const filteredItems = items.filter(i => !(i.collection_id === colId && i.firebase_uid === uid));
  localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(filteredItems));
}

function getLocalItems(uid: string): CollectionItem[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as CollectionItem[];
    return list.filter(i => i.firebase_uid === uid);
  } catch (e) {
    return [];
  }
}

function addLocalItem(item: CollectionItem) {
  if (typeof window === 'undefined') return;
  const items = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY) || '[]') as CollectionItem[];
  // Check duplicate
  const exists = items.some(i => i.collection_id === item.collection_id && i.item_id === item.item_id && i.firebase_uid === item.firebase_uid);
  if (!exists) {
    items.push(item);
    localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(items));
  }
}

function removeLocalItem(uid: string, colId: string, itemId: string) {
  if (typeof window === 'undefined') return;
  const items = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY) || '[]') as CollectionItem[];
  const filtered = items.filter(i => !(i.collection_id === colId && i.item_id === itemId && i.firebase_uid === uid));
  localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(filtered));
}

/**
 * Fetch all collections of a user
 */
export async function getUserCollections(firebaseUid: string): Promise<Collection[]> {
  if (!firebaseUid) return [];

  if (useLocalStorageFallback) {
    return getLocalCollections(firebaseUid);
  }

  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('firebase_uid', firebaseUid);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('La tabla "collections" no existe en Supabase. Usando fallback de localStorage.');
        useLocalStorageFallback = true;
        return getLocalCollections(firebaseUid);
      }
      throw error;
    }

    // Ensure a default 'Guardados' collection is present in Supabase if database exists but user has none
    if (data && data.length === 0) {
      // Create default
      const { data: created, error: createErr } = await supabase
        .from('collections')
        .insert([{ firebase_uid: firebaseUid, name: 'Guardados' }])
        .select();

      if (!createErr && created) {
        return created as Collection[];
      }
    }

    return (data as Collection[]) || [];
  } catch (err) {
    console.warn('Error fetching collections, falling back to localStorage:', err);
    useLocalStorageFallback = true;
    return getLocalCollections(firebaseUid);
  }
}

/**
 * Create a new collection
 */
export async function createNewCollection(firebaseUid: string, name: string): Promise<Collection> {
  if (!firebaseUid || !name.trim()) {
    throw new Error('Información requerida faltante.');
  }

  if (useLocalStorageFallback) {
    return saveLocalCollection(firebaseUid, name.trim());
  }

  try {
    const { data, error } = await supabase
      .from('collections')
      .insert([{ firebase_uid: firebaseUid, name: name.trim() }])
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        useLocalStorageFallback = true;
        return saveLocalCollection(firebaseUid, name.trim());
      }
      throw error;
    }

    return data as Collection;
  } catch (err: any) {
    console.warn('Error creating collection, falling back to localStorage:', err);
    useLocalStorageFallback = true;
    return saveLocalCollection(firebaseUid, name.trim());
  }
}

/**
 * Delete a collection
 */
export async function deleteCollection(firebaseUid: string, collectionId: string): Promise<boolean> {
  if (!firebaseUid || !collectionId) return false;

  if (useLocalStorageFallback || collectionId.startsWith('col-') || collectionId.startsWith('default-')) {
    deleteLocalCollection(firebaseUid, collectionId);
    return true;
  }

  try {
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .eq('firebase_uid', firebaseUid);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Error deleting collection, falling back to localStorage:', err);
    deleteLocalCollection(firebaseUid, collectionId);
    return true;
  }
}

/**
 * Filter out collection items that refer to deleted professors or educational centers,
 * and clean them up from the database/localStorage in the background.
 */
async function filterOrphanCollectionItems(items: CollectionItem[], firebaseUid: string, isLocal: boolean): Promise<CollectionItem[]> {
  if (!items || items.length === 0) return [];

  try {
    const professorIds = items.filter(i => i.item_type === 'professor').map(i => i.item_id);
    const centerIds = items.filter(i => i.item_type === 'center').map(i => i.item_id);

    const existingProfSet = new Set<string>();
    const existingCenterSet = new Set<string>();

    if (professorIds.length > 0) {
      const { data: profs, error: profsErr } = await supabase
        .from('professors')
        .select('id')
        .in('id', professorIds);
      if (!profsErr && profs) {
        profs.forEach(p => existingProfSet.add(p.id));
      }
    }

    if (centerIds.length > 0) {
      const { data: centers, error: centersErr } = await supabase
        .from('educational_centers')
        .select('id')
        .in('id', centerIds);
      if (!centersErr && centers) {
        centers.forEach(c => existingCenterSet.add(c.id));
      }
    }

    const validItems: CollectionItem[] = [];
    const orphanItemIds: string[] = [];

    for (const item of items) {
      const isProfessor = item.item_type === 'professor';
      const exists = isProfessor
        ? existingProfSet.has(item.item_id)
        : existingCenterSet.has(item.item_id);

      if (exists) {
        validItems.push(item);
      } else {
        orphanItemIds.push(item.id);
      }
    }

    // Clean up orphans
    if (orphanItemIds.length > 0) {
      if (isLocal) {
        if (typeof window !== 'undefined') {
          try {
            const allLocalItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY) || '[]') as CollectionItem[];
            const filtered = allLocalItems.filter(i => !orphanItemIds.includes(i.id));
            localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(filtered));
            console.log(`[Collections] Cleaned up ${orphanItemIds.length} orphan local collection items.`);
          } catch (e) {
            console.warn('Error cleaning up local orphans:', e);
          }
        }
      } else {
        supabase
          .from('collection_items')
          .delete()
          .in('id', orphanItemIds)
          .then(({ error }) => {
            if (error) console.warn('[Collections] Error cleaning up orphan collection items from Supabase:', error);
            else console.log(`[Collections] Cleaned up ${orphanItemIds.length} orphan collection items from Supabase.`);
          });
      }
    }

    return validItems;
  } catch (err) {
    console.warn('[Collections] Error filtering orphan collection items:', err);
    return items;
  }
}

/**
 * Fetch all items across all collections of a user
 */
export async function getAllCollectionItems(firebaseUid: string): Promise<CollectionItem[]> {
  if (!firebaseUid) return [];

  if (useLocalStorageFallback) {
    const localItems = getLocalItems(firebaseUid);
    return filterOrphanCollectionItems(localItems, firebaseUid, true);
  }

  try {
    const { data, error } = await supabase
      .from('collection_items')
      .select('*')
      .eq('firebase_uid', firebaseUid);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        useLocalStorageFallback = true;
        const localItems = getLocalItems(firebaseUid);
        return filterOrphanCollectionItems(localItems, firebaseUid, true);
      }
      throw error;
    }

    const items = (data as CollectionItem[]) || [];
    return filterOrphanCollectionItems(items, firebaseUid, false);
  } catch (err) {
    console.warn('Error fetching items, falling back to localStorage:', err);
    useLocalStorageFallback = true;
    const localItems = getLocalItems(firebaseUid);
    return filterOrphanCollectionItems(localItems, firebaseUid, true);
  }
}

/**
 * Check which collections an item belongs to
 */
export async function checkItemCollections(firebaseUid: string, itemId: string): Promise<string[]> {
  if (!firebaseUid || !itemId) return [];

  if (useLocalStorageFallback) {
    const localItems = getLocalItems(firebaseUid);
    return localItems.filter(i => i.item_id === itemId).map(i => i.collection_id);
  }

  try {
    const { data, error } = await supabase
      .from('collection_items')
      .select('collection_id')
      .eq('firebase_uid', firebaseUid)
      .eq('item_id', itemId);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        useLocalStorageFallback = true;
        const localItems = getLocalItems(firebaseUid);
        return localItems.filter(i => i.item_id === itemId).map(i => i.collection_id);
      }
      throw error;
    }

    return data ? data.map(d => d.collection_id) : [];
  } catch (err) {
    console.warn('Error checking item, falling back to localStorage:', err);
    useLocalStorageFallback = true;
    const localItems = getLocalItems(firebaseUid);
    return localItems.filter(i => i.item_id === itemId).map(i => i.collection_id);
  }
}

/**
 * Toggle an item in a specific collection
 */
export async function toggleItemInCollection(
  firebaseUid: string,
  collectionId: string,
  itemId: string,
  itemData: {
    item_type: 'professor' | 'center';
    item_name: string;
    item_image: string | null;
    item_subtitle: string | null;
  }
): Promise<{ added: boolean }> {
  if (!firebaseUid || !collectionId || !itemId) {
    throw new Error('Información requerida faltante.');
  }

  const isLocalId = collectionId.startsWith('col-') || collectionId.startsWith('default-');

  if (useLocalStorageFallback || isLocalId) {
    const items = getLocalItems(firebaseUid);
    const exists = items.some(i => i.collection_id === collectionId && i.item_id === itemId);
    if (exists) {
      removeLocalItem(firebaseUid, collectionId, itemId);
      return { added: false };
    } else {
      const newItem: CollectionItem = {
        id: `item-${Math.random().toString(36).substring(2, 11)}`,
        collection_id: collectionId,
        firebase_uid: firebaseUid,
        item_id: itemId,
        ...itemData,
      };
      addLocalItem(newItem);
      return { added: true };
    }
  }

  try {
    // Check if exists
    const { data: existing, error: checkError } = await supabase
      .from('collection_items')
      .select('id')
      .eq('collection_id', collectionId)
      .eq('item_id', itemId)
      .eq('firebase_uid', firebaseUid)
      .maybeSingle();

    if (checkError) {
      if (checkError.code === '42P01' || checkError.message?.includes('does not exist')) {
        useLocalStorageFallback = true;
        return toggleItemInCollection(firebaseUid, collectionId, itemId, itemData);
      }
      throw checkError;
    }

    if (existing) {
      // Remove
      const { error: deleteError } = await supabase
        .from('collection_items')
        .delete()
        .eq('id', existing.id);

      if (deleteError) throw deleteError;
      return { added: false };
    } else {
      // Add
      const { error: insertError } = await supabase
        .from('collection_items')
        .insert([{
          collection_id: collectionId,
          firebase_uid: firebaseUid,
          item_id: itemId,
          item_type: itemData.item_type,
          item_name: itemData.item_name,
          item_image: itemData.item_image,
          item_subtitle: itemData.item_subtitle,
        }]);

      if (insertError) throw insertError;
      return { added: true };
    }
  } catch (err) {
    console.warn('Error toggling item in collection, falling back to localStorage:', err);
    useLocalStorageFallback = true;
    return toggleItemInCollection(firebaseUid, collectionId, itemId, itemData);
  }
}
