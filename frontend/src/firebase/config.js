// NOTE: Firebase has been completely removed from the frontend.
// This file is kept only so that existing import paths like
// `import { db } from '../firebase/config';` do not break the build.
//
// All exported values are simple stubs and MUST NOT be used for
// any real data access or authentication.

// Legacy placeholders (all null) so tree-shaking can remove them in prod.
export const auth = null;
export const db = null;
export const storage = null;

const app = null;
export default app;
