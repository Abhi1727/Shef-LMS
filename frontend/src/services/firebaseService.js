// NOTE: Firebase has been fully removed from the frontend.
// This file is kept only as a thin compatibility layer so that
// existing components importing `firebaseService` continue to work
// without talking directly to Firebase.

// Collections used around the app. These are now purely semantic
// and may be mapped to backend API routes as needed.
export const COLLECTIONS = {
  USERS: 'users',
  COURSES: 'courses',
  MODULES: 'modules',
  LESSONS: 'lessons',
  ACTIVITIES: 'activities',
  PROJECTS: 'projects',
  ASSESSMENTS: 'assessments',
  JOBS: 'jobs',
  MENTORS: 'mentors',
  STATS: 'stats',
  CONTENT: 'content',
  CLASSROOM: 'classroom',
  LIVE_CLASSES: 'liveClasses'
};

const logDeprecated = (operation, collectionName) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      `[firebaseService] ${operation} on collection "${collectionName}" is deprecated. ` +
      'The frontend no longer uses Firebase/Firestore. Please use backend APIs instead.'
    );
  }
};

// Compatibility no-op service. All methods either return
// empty results or errors, so callers should already have
// defensive fallbacks (most do).
export const firebaseService = {
  async create(collectionName, data) {
    logDeprecated('create', collectionName);
    return { success: false, error: 'Firebase has been removed. Use backend APIs instead.' };
  },

  async getById(collectionName, id) {
    logDeprecated('getById', collectionName);
    return { success: false, error: 'Firebase has been removed. Use backend APIs instead.' };
  },

  async getAll(collectionName /*, queryConstraints = [] */) {
    logDeprecated('getAll', collectionName);
    // Return an empty data set so UI can render gracefully
    return { success: true, data: [] };
  },

  async update(collectionName, id, data) {
    logDeprecated('update', collectionName);
    return { success: false, error: 'Firebase has been removed. Use backend APIs instead.' };
  },

  async delete(collectionName, id) {
    logDeprecated('delete', collectionName);
    return { success: false, error: 'Firebase has been removed. Use backend APIs instead.' };
  },

  async query(collectionName, conditions = []) {
    logDeprecated('query', collectionName);
    return { success: true, data: [] };
  }
};
