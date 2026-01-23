import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

const SEARCHES_COLLECTION = 'searches';

/**
 * Save a search to the user's history
 * @param {string} userId - The user's ID
 * @param {string} symptoms - The symptoms searched
 * @param {object} result - The triage result
 */
export async function saveSearch(userId, symptoms, result) {
  try {
    await addDoc(collection(db, SEARCHES_COLLECTION), {
      userId,
      symptoms,
      result,
      createdAt: serverTimestamp()
    });
    // console.log('Search saved successfully');
  } catch (error) {
    console.error('Error saving search:', error);
    throw error;
  }
}

/**
 * Get the user's search history
 * @param {string} userId - The user's ID
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} Array of search history items
 */
export async function getSearchHistory(userId, maxResults = 10) {
  try {
    // Simple query without orderBy to avoid needing composite index
    // We'll sort client-side instead
    const q = query(
      collection(db, SEARCHES_COLLECTION),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const searches = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      searches.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamp to JS Date, handle null case
        createdAt: data.createdAt?.toDate() || new Date()
      });
    });
    
    // Sort by createdAt descending (newest first) client-side
    searches.sort((a, b) => b.createdAt - a.createdAt);
    
    // Limit results
    const limitedSearches = searches.slice(0, maxResults);
    
    console.log('Fetched search history:', limitedSearches.length, 'items');
    return limitedSearches;
  } catch (error) {
    console.error('Error fetching search history:', error);
    // Return empty array instead of throwing to prevent UI breaking
    return [];
  }
}
