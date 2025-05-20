import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  // where, // Not currently used in fetchAllTags, but keep if needed elsewhere
  writeBatch,
  getDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

interface TagDoc {
  name: string;
  createdAt: any;
}

const TAGS_COLLECTION = 'tags';

export const INITIAL_COMMON_TAGS = [
  'AI/ML', 'Robotics', 'UX Design', 'Full-Stack', 'Quant', 'AR/VR',
  'Music Tech', 'Earth System', 'Biomedical', 'Sustainability',
  'Entrepreneurship', 'Social Impact', 'Blockchain', 'Hardware',
  'Embedded', 'Freelance', 'Photography', 'Game Dev', 'iOS',
  'Android', 'Web3', 'Cloud', 'Security', 'Product', 'Ed-Tech',
  'Data Viz', 'Graphics', 'ML Ops', 'Miscellaneous', 'HCI',
];

/**
 * Creates a Firestore-safe document ID from a tag name.
 * Converts to lowercase and replaces slashes with hyphens.
 * @param tagName The original tag name.
 * @returns A Firestore-safe string ID.
 */
function createTagId(tagName: string): string {
  return tagName.toLowerCase().replace(/\//g, '-'); // Replace all slashes with hyphens
}

export async function seedInitialTags(): Promise<void> {
  const tagsCollectionRef = collection(db, TAGS_COLLECTION);
  const batch = writeBatch(db);
  let operationsCount = 0;

  console.log('Attempting to seed initial tags...');

  for (const tagName of INITIAL_COMMON_TAGS) {
    const tagId = createTagId(tagName); // Use the new ID creation function
    const tagDocRef = doc(db, TAGS_COLLECTION, tagId);

    try {
      const docSnap = await getDoc(tagDocRef);
      if (!docSnap.exists()) {
        batch.set(tagDocRef, {
          name: tagName, // Store original name
          createdAt: serverTimestamp(),
        });
        operationsCount++;
        console.log(`Scheduled to add tag: "${tagName}" (ID: ${tagId})`);
      }
    } catch (error) {
      console.error(`Error checking/scheduling tag "${tagName}":`, error);
    }
  }

  if (operationsCount > 0) {
    try {
      await batch.commit();
      console.log(`${operationsCount} initial tags successfully written to Firestore.`);
    } catch (error) {
      console.error('Error committing batch for seeding tags:', error);
    }
  } else {
    console.log('No new initial tags to seed, or all already exist in Firestore.');
  }
}

export async function fetchAllTags(): Promise<string[]> {
  try {
    const tagsCollectionRef = collection(db, TAGS_COLLECTION);
    const q = query(tagsCollectionRef, orderBy('name'));
    const querySnapshot = await getDocs(q);
    const tags: string[] = [];
    querySnapshot.forEach((doc) => {
      tags.push(doc.data().name as string);
    });
    // console.log('Fetched tags from Firestore:', tags);
    return tags;
  } catch (error) {
    console.error('Error fetching tags from Firestore:', error);
    return [...INITIAL_COMMON_TAGS]; // Fallback
  }
}

export async function addGlobalTag(tagName: string, _uid?: string): Promise<boolean> {
  if (!tagName || tagName.trim() === '') {
    console.warn('Attempted to add an empty tag.');
    return false;
  }

  const trimmedTagName = tagName.trim();
  const tagId = createTagId(trimmedTagName); // Use the new ID creation function
  const tagDocRef = doc(db, TAGS_COLLECTION, tagId);

  try {
    const docSnap = await getDoc(tagDocRef);
    if (!docSnap.exists()) {
      await setDoc(tagDocRef, {
        name: trimmedTagName, // Store original name
        createdAt: serverTimestamp(),
      });
      console.log(`Tag "${trimmedTagName}" (ID: ${tagId}) added to Firestore.`);
      return true;
    } else {
      // console.log(`Tag "${trimmedTagName}" (ID: ${tagId}) already exists.`);
      return false;
    }
  } catch (error) {
    console.error(`Error adding tag "${trimmedTagName}" (ID: ${tagId}) to Firestore:`, error);
    return false;
  }
}
