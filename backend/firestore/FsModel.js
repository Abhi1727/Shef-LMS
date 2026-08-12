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
  if (query.$or) {
    return query.$or.some((q) => matchQuery(doc, q));
  }
  if (query.$and) {
    return query.$and.every((q) => matchQuery(doc, q));
  }
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

function createFsModel(name, collectionName) {
  const cache = { docs: null, loadedAt: 0 };
  const CACHE_MS = 5000;

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
        delete plain.toObject;
        delete plain.toJSON;
        delete plain.$__;
        const saved = await firestoreDb.setDoc(collectionName, id, plain);
        invalidate();
        Object.assign(this, saved);
        this.isNew = false;
        return this;
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
    } else {
      docs = await loadAll();
      docs = docs.filter((d) => matchQuery(d, filter));
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

  Model.countDocuments = async function countDocuments(filter = {}) {
    const rows = await Model.find(filter).lean().exec();
    return rows.length;
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

  Model.updateOne = async function updateOne(filter, update) {
    const doc = await Model.findOne(filter).lean().exec();
    if (!doc) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    const next = applyUpdate(doc, update);
    next.updatedAt = new Date();
    await firestoreDb.setDoc(collectionName, asString(doc._id), next);
    invalidate();
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  };

  Model.updateMany = async function updateMany(filter, update) {
    const docs = await Model.find(filter).lean().exec();
    for (const doc of docs) {
      const next = applyUpdate(doc, update);
      next.updatedAt = new Date();
      await firestoreDb.setDoc(collectionName, asString(doc._id), next);
    }
    invalidate();
    return { acknowledged: true, matchedCount: docs.length, modifiedCount: docs.length };
  };

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

  Model.deleteOne = async function deleteOne(filter) {
    const doc = await Model.findOne(filter).lean().exec();
    if (!doc) return { acknowledged: true, deletedCount: 0 };
    await firestoreDb.deleteDoc(collectionName, asString(doc._id));
    invalidate();
    return { acknowledged: true, deletedCount: 1 };
  };

  Model.deleteMany = async function deleteMany(filter = {}) {
    const docs = await Model.find(filter).lean().exec();
    for (const doc of docs) {
      await firestoreDb.deleteDoc(collectionName, asString(doc._id));
    }
    invalidate();
    return { acknowledged: true, deletedCount: docs.length };
  };

  // Aggregate stub — return empty / simple match for Phase 1 safety
  Model.aggregate = async function aggregate(pipeline = []) {
    let docs = await loadAll();
    for (const stage of pipeline) {
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
