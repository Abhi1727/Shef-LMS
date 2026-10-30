/**
 * Mongoose-compatible Firestore model facade for DEV runtime.
 * Supports the query shapes used by auth/batches/classroom/meetings/student/teacher.
 */
const crypto = require('crypto');
const firestoreDb = require('../services/firestoreDb');

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function asString(v) {
  if (v == null) return v;
  if (typeof v === 'object' && typeof v.toHexString === 'function') return v.toHexString();
  if (typeof v === 'object' && v._bsontype) return String(v);
  return String(v);
}

function valuesEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a)) {
    // equality of scalar against array → membership (Mongo behavior for some queries)
    if (!Array.isArray(b)) return a.map(asString).includes(asString(b));
  }
  if (Array.isArray(b) && !Array.isArray(a)) {
    return b.map(asString).includes(asString(a));
  }
  return asString(a) === asString(b);
}

function matchCondition(docValue, cond) {
  if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date) && !cond._bsontype) {
    if ('$in' in cond) {
      const list = (cond.$in || []).map(asString);
      if (Array.isArray(docValue)) {
        return docValue.some((x) => list.includes(asString(x)));
      }
      return list.includes(asString(docValue));
    }
    if ('$nin' in cond) {
      const list = (cond.$nin || []).map(asString);
      return !list.includes(asString(docValue));
    }
    if ('$ne' in cond) return !valuesEqual(docValue, cond.$ne);
    if ('$gt' in cond) return docValue > cond.$gt;
    if ('$gte' in cond) return docValue >= cond.$gte;
    if ('$lt' in cond) return docValue < cond.$lt;
    if ('$lte' in cond) return docValue <= cond.$lte;
    if ('$exists' in cond) {
      const exists = docValue !== undefined && docValue !== null;
      return cond.$exists ? exists : !exists;
    }
    if ('$regex' in cond) {
      const flags = cond.$options || '';
      const re = new RegExp(cond.$regex, flags);
      return re.test(String(docValue ?? ''));
    }
    // nested object equality fallback
    return valuesEqual(docValue, cond);
  }
  // Mongo: { students: userId } matches array containing userId
  if (Array.isArray(docValue)) {
    return docValue.map(asString).includes(asString(cond));
  }
  return valuesEqual(docValue, cond);
}

function matchQuery(doc, query = {}) {
  if (!query || Object.keys(query).length === 0) return true;
  if (query.$or && !query.$or.some((q) => matchQuery(doc, q))) return false;
  if (query.$and && !query.$and.every((q) => matchQuery(doc, q))) return false;
  for (const [key, cond] of Object.entries(query)) {
    if (key.startsWith('$')) continue;
    if (key === '_id' || key === 'id') {
      const id = asString(doc._id || doc.id);
      if (!matchCondition(id, cond)) return false;
      continue;
    }
    if (!matchCondition(doc[key], cond)) return false;
  }
  return true;
}

function applySelect(doc, select) {
  if (!select) return { ...doc };
  let fields = select;
  if (typeof select === 'string') {
    fields = select.split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(fields)) {
    const include = {};
    const exclude = [];
    for (const f of fields) {
      if (f.startsWith('-')) exclude.push(f.slice(1));
      else include[f] = 1;
    }
    if (exclude.length && Object.keys(include).length === 0) {
      const out = { ...doc };
      exclude.forEach((f) => delete out[f]);
      return out;
    }
    const out = { _id: doc._id, id: doc.id };
    for (const f of Object.keys(include)) {
      if (f === '_id' || f === 'id') continue;
      out[f] = doc[f];
    }
    return out;
  }
  if (typeof fields === 'object') {
    const keys = Object.keys(fields);
    const isExclude = keys.every((k) => fields[k] === 0);
    if (isExclude) {
      const out = { ...doc };
      keys.forEach((k) => delete out[k]);
      return out;
    }
    const out = { _id: doc._id, id: doc.id };
    for (const [k, v] of Object.entries(fields)) {
      if (v) out[k] = doc[k];
    }
    return out;
  }
  return { ...doc };
}

function sortDocs(docs, sort) {
  if (!sort) return docs;
  const entries = Object.entries(sort);
  return [...docs].sort((a, b) => {
    for (const [field, dir] of entries) {
      const av = a[field];
      const bv = b[field];
      if (av == null && bv == null) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return dir < 0 ? 1 : -1;
      if (av > bv) return dir < 0 ? -1 : 1;
    }
    return 0;
  });
}

function applyUpdate(doc, update) {
  const out = { ...doc };
  if (!update || typeof update !== 'object') return out;
  if (update.$set || update.$unset || update.$push || update.$addToSet || update.$pull || update.$inc) {
    if (update.$set) Object.assign(out, update.$set);
    if (update.$unset) {
      for (const k of Object.keys(update.$unset)) delete out[k];
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        out[k] = Number(out[k] || 0) + Number(v);
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        const arr = Array.isArray(out[k]) ? [...out[k]] : [];
        if (v && typeof v === 'object' && v.$each) arr.push(...v.$each);
        else arr.push(v);
        out[k] = arr;
      }
    }
    if (update.$addToSet) {
      for (const [k, v] of Object.entries(update.$addToSet)) {
        const arr = Array.isArray(out[k]) ? [...out[k]] : [];
        const vals = v && typeof v === 'object' && v.$each ? v.$each : [v];
        for (const item of vals) {
          if (!arr.map(asString).includes(asString(item))) arr.push(item);
        }
        out[k] = arr;
      }
    }
    if (update.$pull) {
      for (const [k, v] of Object.entries(update.$pull)) {
        const arr = Array.isArray(out[k]) ? out[k] : [];
        out[k] = arr.filter((x) => !valuesEqual(x, v));
      }
    }
    return out;
  }
  // direct replace fields
  return { ...out, ...update };
}

const SELECTIVE_FIELDS = [
  'email',
  'firestoreId',
  'userId',
  'studentId',
  'teacherId',
  'batchId',
  'oneToOneBatchId',
  'classroomLectureId',
  'classroomId',
  'meetSpaceId',
  'videoId',
  'enrollmentNumber',
  'formNumber',
  'action',
  'students',
  'userRole',
  'role',
  'status',
  'meetLink'
];

const ARRAY_CONTAINS_FIELDS = new Set(['students']);

function condToPredicate(field, cond) {
  if (cond === undefined) return null;
  if (ARRAY_CONTAINS_FIELDS.has(field)) {
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date) && !cond._bsontype && !('$eq' in (cond || {}))) {
      if ('$in' in cond) {
        const list = (cond.$in || []).slice(0, 10);
        if (!list.length) return null;
        return { field, op: 'ARRAY_CONTAINS_ANY', value: list.map(asString) };
      }
      return null;
    }
    return { field, op: 'ARRAY_CONTAINS', value: asString(cond) };
  }
  const isPlainObject =
    cond &&
    typeof cond === 'object' &&
    !Array.isArray(cond) &&
    !(cond instanceof Date) &&
    !cond._bsontype &&
    typeof cond.toHexString !== 'function';
  if (!isPlainObject) {
    const value =
      cond instanceof Date ? cond : typeof cond === 'object' && cond != null ? asString(cond) : cond;
    return { field, op: 'EQUAL', value };
  }
  if ('$eq' in cond) return { field, op: 'EQUAL', value: cond.$eq };
  if ('$in' in cond) {
    const list = (cond.$in || []).filter((v) => v !== undefined).slice(0, 10);
    if (!list.length) return null;
    if (list.length === 1) return { field, op: 'EQUAL', value: list[0] };
    return { field, op: 'IN', value: list };
  }
  if ('$ne' in cond) return { field, op: 'NOT_EQUAL', value: cond.$ne };
  if ('$gt' in cond) return { field, op: 'GREATER_THAN', value: cond.$gt };
  if ('$gte' in cond) return { field, op: 'GREATER_THAN_OR_EQUAL', value: cond.$gte };
  if ('$lt' in cond) return { field, op: 'LESS_THAN', value: cond.$lt };
  if ('$lte' in cond) return { field, op: 'LESS_THAN_OR_EQUAL', value: cond.$lte };
  return null;
}

function pickPredicate(filter) {
  if (!filter || typeof filter !== 'object') return null;
  for (const field of SELECTIVE_FIELDS) {
    if (filter[field] === undefined) continue;
    const pred = condToPredicate(field, filter[field]);
    if (pred) return pred;
  }
  for (const [field, cond] of Object.entries(filter)) {
    if (field.startsWith('$') || field === '_id' || field === 'id') continue;
    const pred = condToPredicate(field, cond);
    if (pred) return pred;
  }
  return null;
}

const SINGLE_KEY_QUERY_CAP = 1000;

function filterKeyCount(filter) {
  if (!filter) return 0;
  return Object.keys(filter).filter((k) => k !== '$or' && k !== '$and').length;
}

async function queryWithPredicate(collectionName, pred, extras = {}) {
  return firestoreDb.queryCollection(collectionName, {
    where: pred,
    ...extras
  });
}

async function fetchMatchingDocs(collectionName, filter, loadAllFn) {
  if (!filter || Object.keys(filter).length === 0) {
    return loadAllFn();
  }

  // Fast path: { $or: [{ _id }, { firestoreId }] } — common user lookup (avoid full scan)
  if (
    filter.$or &&
    Array.isArray(filter.$or) &&
    filter.$or.length === 2 &&
    Object.keys(filter).length === 1
  ) {
    const idBranch = filter.$or.find((b) => b && b._id != null);
    const fsBranch = filter.$or.find((b) => b && b.firestoreId != null);
    if (idBranch && fsBranch) {
      const docId = asString(idBranch._id);
      if (docId) {
        let doc = await firestoreDb.getDoc(collectionName, docId);
        if (!doc) {
          const fsId = asString(fsBranch.firestoreId);
          if (fsId) {
            try {
              const rows = await queryWithPredicate(
                collectionName,
                { field: 'firestoreId', op: 'EQUAL', value: fsId },
                { limit: 1 }
              );
              doc = rows[0] || null;
            } catch (err) {
              if (!err.indexRequired) {
                console.warn('[FsModel] firestoreId lookup fallback:', err.message);
              }
            }
          }
        }
        return doc ? [doc] : [];
      }
    }
  }

  if (filter.$or && Array.isArray(filter.$or) && filter.$or.length && filter.$or.length <= 6) {
    const rest = { ...filter };
    delete rest.$or;
    const merged = [];
    try {
      for (const branch of filter.$or) {
        const part = await fetchMatchingDocs(collectionName, { ...rest, ...branch }, loadAllFn);
        merged.push(...part);
      }
      const map = new Map();
      for (const d of merged) map.set(asString(d._id || d.id), d);
      return [...map.values()];
    } catch (err) {
      if (!err.indexRequired) console.warn('[FsModel] $or query fallback:', err.message);
      return (await loadAllFn()).filter((d) => matchQuery(d, filter));
    }
  }

  const pred = pickPredicate(filter);
  if (!pred) {
    return (await loadAllFn()).filter((d) => matchQuery(d, filter));
  }

  try {
    const rawIn = pred && filter[pred.field] && filter[pred.field].$in;
    if (Array.isArray(rawIn) && rawIn.length > 10) {
      const merged = [];
      for (let i = 0; i < rawIn.length; i += 10) {
        const sliceFilter = { ...filter, [pred.field]: { $in: rawIn.slice(i, i + 10) } };
        merged.push(...(await fetchMatchingDocs(collectionName, sliceFilter, loadAllFn)));
      }
      const map = new Map();
      for (const d of merged) map.set(asString(d._id || d.id), d);
      return [...map.values()].filter((d) => matchQuery(d, filter));
    }
    const extras = {};
    // NOT_EQUAL matches most of a collection, so a capped first attempt would only be thrown away.
    if (filterKeyCount(filter) === 1 && pred.op !== 'NOT_EQUAL') {
      extras.limit = SINGLE_KEY_QUERY_CAP;
    }
    const docs = await queryWithPredicate(collectionName, pred, extras);
    // Hitting the cap means rows were dropped; callers expect the full Mongo-style result.
    if (extras.limit && docs.length >= extras.limit) {
      const all = await queryWithPredicate(collectionName, pred);
      return all.filter((d) => matchQuery(d, filter));
    }
    return docs.filter((d) => matchQuery(d, filter));
  } catch (err) {
    console.warn('[FsModel] field query fallback to full scan', collectionName, pred.field, err.message);
    return (await loadAllFn()).filter((d) => matchQuery(d, filter));
  }
}

class Query {
  constructor(model, filter = {}) {
    this.model = model;
    this.filter = filter;
    this._select = null;
    this._sort = null;
    this._limit = null;
    this._skip = 0;
    this._lean = false;
    this._populate = [];
  }

  select(s) {
    this._select = s;
    return this;
  }

  sort(s) {
    this._sort = s;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  skip(n) {
    this._skip = n || 0;
    return this;
  }

  lean() {
    this._lean = true;
    return this;
  }

  populate(path, select) {
    if (path && typeof path === 'object') {
      this._populate.push(path);
    } else {
      this._populate.push({ path, select });
    }
    return this;
  }

  async exec() {
    return this.model._executeFind(this);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

const CACHE_MS_BY_COLLECTION = {
  classrooms: 180000,
  batches: 180000,
  courses: 300000,
  modules: 180000,
  resources: 180000,
  resourcecategories: 300000,
  users: 90000,
  liveclasses: 90000,
  activitylogs: 60000
};

function createFsModel(name, collectionName) {
  const cache = { docs: null, loadedAt: 0 };
  const CACHE_MS = CACHE_MS_BY_COLLECTION[collectionName] || 30000;

  async function loadAll(force = false) {
    if (!force && cache.docs && Date.now() - cache.loadedAt < CACHE_MS) {
      return cache.docs;
    }
    const docs = await firestoreDb.listCollection(collectionName);
    cache.docs = docs;
    cache.loadedAt = Date.now();
    return docs;
  }

  function invalidate() {
    cache.docs = null;
    cache.loadedAt = 0;
  }

  function wrapDoc(raw, lean = false) {
    if (!raw) return null;
    if (lean) {
      return { ...raw, id: String(raw._id || raw.id), _id: raw._id || raw.id };
    }
    const data = { ...raw };
    const doc = {
      ...data,
      _id: data._id || data.id,
      id: String(data._id || data.id),
      isNew: false,
      toObject() {
        return { ...this, _id: this._id, id: this.id };
      },
      toJSON() {
        return this.toObject();
      },
      async save() {
        const id = asString(this._id || this.id) || newId();
        this._id = id;
        this.id = id;
        const plain = { ...this };
        delete plain.isNew;
        delete plain.save;
        delete plain.deleteOne;
        delete plain.toObject;
        delete plain.toJSON;
        delete plain.$__;
        const saved = await firestoreDb.setDoc(collectionName, id, plain);
        invalidate();
        Object.assign(this, saved);
        this.isNew = false;
        return this;
      },
      async deleteOne() {
        const id = asString(this._id || this.id);
        if (!id) return { acknowledged: true, deletedCount: 0 };
        await firestoreDb.deleteDoc(collectionName, id);
        invalidate();
        return { acknowledged: true, deletedCount: 1 };
      }
    };
    return doc;
  }

  const Model = function Model(data = {}) {
    const id = asString(data._id || data.id) || newId();
    const doc = wrapDoc({ ...data, _id: id, id }, false);
    doc.isNew = !data._id && !data.id;
    return doc;
  };

  Model.modelName = name;
  Model.collection = { name: collectionName };
  Model._invalidate = invalidate;

  Model._executeFind = async function executeFind(q) {
    const filter = q.filter || {};
    let docs;

    // Fast path: by id
    if (filter._id && typeof filter._id !== 'object') {
      const one = await firestoreDb.getDoc(collectionName, asString(filter._id));
      docs = one ? [one] : [];
    } else if (filter._id && filter._id.$in) {
      docs = await firestoreDb.batchGet(
        collectionName,
        (filter._id.$in || []).map(asString)
      );
    } else if (filter.id && typeof filter.id !== 'object') {
      const one = await firestoreDb.getDoc(collectionName, asString(filter.id));
      docs = one ? [one] : [];
    }
    if (docs) {
      // Id lookups must still honour the other conditions (ownership checks like { _id, studentId }).
      docs = docs.filter((d) => matchQuery(d, filter));
    } else if (!filter || Object.keys(filter).length === 0) {
      if (q._limit != null && q._limit <= 500 && (q._skip || 0) + q._limit <= 500) {
        try {
          const take = (q._skip || 0) + q._limit;
          docs = await firestoreDb.queryCollection(collectionName, {
            orderBy: q._sort,
            limit: take
          });
        } catch (err) {
          docs = await loadAll();
        }
      } else {
        docs = await loadAll();
      }
    } else {
      docs = await fetchMatchingDocs(collectionName, filter, loadAll);
    }

    docs = sortDocs(docs, q._sort);
    if (q._skip) docs = docs.slice(q._skip);
    if (q._limit != null) docs = docs.slice(0, q._limit);

    // populate (DEV: resolve refs from users/batches/etc.)
    if (q._populate && q._populate.length) {
      const fsModels = require('./models');
      for (const pop of q._populate) {
        const path = pop.path;
        if (!path) continue;
        const refModelName =
          path === 'students' || path === 'studentId' || path === 'userId' || path === 'teacherId'
            ? 'User'
            : path === 'batchId'
              ? 'Batch'
              : path === 'classroomId'
                ? 'Classroom'
                : null;
        const Ref = refModelName ? fsModels[refModelName] : null;
        if (!Ref) continue;
        const ids = [];
        for (const d of docs) {
          const val = d[path];
          if (Array.isArray(val)) ids.push(...val.map(asString));
          else if (val != null) ids.push(asString(val));
        }
        const unique = [...new Set(ids.filter(Boolean))];
        const related = unique.length
          ? await firestoreDb.batchGet(Ref.collection.name, unique)
          : [];
        const map = new Map(related.map((r) => [asString(r._id), r]));
        docs = docs.map((d) => {
          const val = d[path];
          let populated;
          if (Array.isArray(val)) {
            populated = val.map((id) => {
              const hit = map.get(asString(id));
              return hit ? applySelect(hit, pop.select) : id;
            });
          } else if (val != null) {
            const hit = map.get(asString(val));
            populated = hit ? applySelect(hit, pop.select) : val;
          } else {
            populated = val;
          }
          return { ...d, [path]: populated };
        });
      }
    }

    docs = docs.map((d) => {
      const selected = applySelect(d, q._select);
      return wrapDoc(selected, q._lean);
    });
    return docs;
  };

  Model.distinct = async function distinct(field, filter = {}) {
    const docs = await Model.find(filter).lean().exec();
    const set = new Set();
    for (const d of docs) {
      const v = d[field];
      if (Array.isArray(v)) v.forEach((x) => set.add(asString(x)));
      else if (v != null) set.add(asString(v));
    }
    return [...set];
  };

  Model.find = function find(filter = {}) {
    return new Query(Model, filter);
  };

  Model.findOne = function findOne(filter = {}) {
    const q = new Query(Model, filter);
    q._limit = 1;
    const origExec = q.exec.bind(q);
    q.exec = async () => {
      const rows = await origExec();
      return rows[0] || null;
    };
    return q;
  };

  Model.findById = function findById(id) {
    return Model.findOne({ _id: asString(id) });
  };

  function withExec(asyncFn) {
    return function wrapped(...args) {
      const promise = Promise.resolve(asyncFn.apply(this, args));
      promise.exec = function exec() {
        return promise;
      };
      return promise;
    };
  }

  Model.countDocuments = function countDocuments(filter = {}) {
    // Mongoose-compatible: await Model.countDocuments(filter) or .exec()
    const promise = (async () => {
      if (!filter || Object.keys(filter).length === 0) {
        try {
          return await firestoreDb.countCollection(collectionName);
        } catch (err) {
          console.warn('[FsModel] count fallback', collectionName, err.message);
        }
      } else {
        const pred = pickPredicate(filter);
        if (pred && filterKeyCount(filter) === 1 && !filter.$or && !filter.$and) {
          try {
            return await firestoreDb.countCollection(collectionName, { where: pred });
          } catch (err) {
            console.warn('[FsModel] filtered count fallback', collectionName, err.message);
          }
        }
      }
      const rows = await Model.find(filter).lean().exec();
      return rows.length;
    })();
    promise.exec = function exec() {
      return promise;
    };
    return promise;
  };

  Model.create = async function create(data) {
    if (Array.isArray(data)) {
      const out = [];
      for (const item of data) out.push(await Model.create(item));
      return out;
    }
    const id = asString(data._id || data.id) || newId();
    const plain = { ...data, _id: id, id, createdAt: data.createdAt || new Date(), updatedAt: new Date() };
    const saved = await firestoreDb.setDoc(collectionName, id, plain);
    invalidate();
    return wrapDoc(saved, false);
  };

  Model.updateOne = withExec(async function updateOne(filter, update) {
    const doc = await Model.findOne(filter).lean().exec();
    if (!doc) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    const next = applyUpdate(doc, update);
    next.updatedAt = new Date();
    await firestoreDb.setDoc(collectionName, asString(doc._id), next);
    invalidate();
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });

  Model.updateMany = withExec(async function updateMany(filter, update) {
    const docs = await Model.find(filter).lean().exec();
    for (const doc of docs) {
      const next = applyUpdate(doc, update);
      next.updatedAt = new Date();
      await firestoreDb.setDoc(collectionName, asString(doc._id), next);
    }
    invalidate();
    return { acknowledged: true, matchedCount: docs.length, modifiedCount: docs.length };
  });

  Model.findByIdAndUpdate = function findByIdAndUpdate(id, update, options = {}) {
    const q = {
      _id: asString(id),
      update,
      options,
      _select: null,
      _lean: Boolean(options.lean),
      select(s) {
        this._select = s;
        return this;
      },
      lean() {
        this._lean = true;
        return this;
      },
      async exec() {
        const doc = await Model.findOne({ _id: this._id }).lean().exec();
        if (!doc) return null;
        const next = applyUpdate(doc, this.update);
        next.updatedAt = new Date();
        const saved = await firestoreDb.setDoc(collectionName, this._id, next);
        invalidate();
        const raw = this.options.new === false ? doc : saved;
        const selected = applySelect(raw, this._select);
        return wrapDoc(selected, this._lean || this.options.lean);
      },
      then(resolve, reject) {
        return this.exec().then(resolve, reject);
      }
    };
    return q;
  };

  Model.findOneAndUpdate = function findOneAndUpdate(filter, update, options = {}) {
    const q = {
      filter,
      update,
      options,
      _select: null,
      _lean: Boolean(options.lean),
      select(s) {
        this._select = s;
        return this;
      },
      lean() {
        this._lean = true;
        return this;
      },
      async exec() {
        let doc = await Model.findOne(this.filter).lean().exec();
        if (!doc) {
          if (this.options.upsert) {
            const created = await Model.create({
              ...(typeof this.filter === 'object' ? this.filter : {}),
              ...(this.update.$set || (this.update.$set === undefined ? this.update : {}))
            });
            return this._lean ? created.toObject?.() || created : created;
          }
          return null;
        }
        const next = applyUpdate(doc, this.update);
        next.updatedAt = new Date();
        const saved = await firestoreDb.setDoc(collectionName, asString(doc._id), next);
        invalidate();
        const raw = this.options.new === false ? doc : saved;
        const selected = applySelect(raw, this._select);
        return wrapDoc(selected, this._lean || this.options.lean);
      },
      then(resolve, reject) {
        return this.exec().then(resolve, reject);
      }
    };
    return q;
  };

  Model.findByIdAndDelete = function findByIdAndDelete(id) {
    const q = {
      _id: asString(id),
      _lean: false,
      lean() {
        this._lean = true;
        return this;
      },
      async exec() {
        const doc = await Model.findById(this._id).lean().exec();
        if (!doc) return null;
        await firestoreDb.deleteDoc(collectionName, this._id);
        invalidate();
        return wrapDoc(doc, this._lean);
      },
      then(resolve, reject) {
        return this.exec().then(resolve, reject);
      }
    };
    return q;
  };

  Model.findOneAndDelete = function findOneAndDelete(filter) {
    const q = {
      filter,
      _lean: false,
      lean() {
        this._lean = true;
        return this;
      },
      async exec() {
        const doc = await Model.findOne(this.filter).lean().exec();
        if (!doc) return null;
        await firestoreDb.deleteDoc(collectionName, asString(doc._id));
        invalidate();
        return wrapDoc(doc, this._lean);
      },
      then(resolve, reject) {
        return this.exec().then(resolve, reject);
      }
    };
    return q;
  };

  Model.deleteOne = withExec(async function deleteOne(filter) {
    const doc = await Model.findOne(filter).lean().exec();
    if (!doc) return { acknowledged: true, deletedCount: 0 };
    await firestoreDb.deleteDoc(collectionName, asString(doc._id));
    invalidate();
    return { acknowledged: true, deletedCount: 1 };
  });

  Model.deleteMany = withExec(async function deleteMany(filter = {}) {
    const docs = await Model.find(filter).lean().exec();
    for (const doc of docs) {
      await firestoreDb.deleteDoc(collectionName, asString(doc._id));
    }
    invalidate();
    return { acknowledged: true, deletedCount: docs.length };
  });

  // Aggregate stub — return empty / simple match for Phase 1 safety
  Model.aggregate = async function aggregate(pipeline = []) {
    const stages = [...pipeline];
    let docs;
    if (stages[0] && stages[0].$match) {
      docs = await fetchMatchingDocs(collectionName, stages[0].$match, loadAll);
      stages.shift();
    } else {
      docs = await loadAll();
    }
    for (const stage of stages) {
      if (stage.$match) docs = docs.filter((d) => matchQuery(d, stage.$match));
      if (stage.$sort) docs = sortDocs(docs, stage.$sort);
      if (stage.$limit) docs = docs.slice(0, stage.$limit);
      if (stage.$skip) docs = docs.slice(stage.$skip);
      if (stage.$project) {
        docs = docs.map((d) => applySelect(d, stage.$project));
      }
      if (stage.$group) {
        // Minimal group support for common admin patterns
        const groups = new Map();
        const idExpr = stage.$group._id;
        for (const d of docs) {
          let key;
          if (idExpr == null) key = 'null';
          else if (typeof idExpr === 'string' && idExpr.startsWith('$')) key = String(d[idExpr.slice(1)]);
          else key = JSON.stringify(idExpr);
          if (!groups.has(key)) groups.set(key, { _id: idExpr == null ? null : key, __docs: [] });
          groups.get(key).__docs.push(d);
        }
        docs = [...groups.values()].map((g) => {
          const out = { _id: g._id };
          for (const [field, expr] of Object.entries(stage.$group)) {
            if (field === '_id') continue;
            if (expr.$sum === 1) out[field] = g.__docs.length;
            else if (typeof expr.$sum === 'string' && expr.$sum.startsWith('$')) {
              out[field] = g.__docs.reduce((s, x) => s + Number(x[expr.$sum.slice(1)] || 0), 0);
            } else if (expr.$sum != null) out[field] = g.__docs.length * Number(expr.$sum || 0);
            else if (expr.$avg && typeof expr.$avg === 'string') {
              const vals = g.__docs.map((x) => Number(x[expr.$avg.slice(1)] || 0));
              out[field] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            } else if (expr.$first && typeof expr.$first === 'string') {
              out[field] = g.__docs[0]?.[expr.$first.slice(1)];
            } else if (expr.$push && typeof expr.$push === 'string') {
              out[field] = g.__docs.map((x) => x[expr.$push.slice(1)]);
            }
          }
          return out;
        });
      }
    }
    return docs;
  };

  return Model;
}

module.exports = { createFsModel, newId, asString };
