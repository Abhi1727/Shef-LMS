/**
 * Idempotent seed: Data Science & AI module categories + notebook resources
 * from content/course-notebooks/data-science-ai.
 *
 * Usage:
 *   ENV_PATH=.env.dev node scripts/seed-ds-notebooks.js
 *   ENV_PATH=.env node scripts/seed-ds-notebooks.js
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const fs = require('fs');
const path = require('path');
const { connectMongo } = require('../config/mongo');
const Batch = require('../models/Batch');
const OneToOneBatch = require('../models/OneToOneBatch');
const Resource = require('../models/Resource');
const ResourceCategory = require('../models/ResourceCategory');
const { getContentRoot } = require('../utils/contentPaths');

const MODULE_DEFS = [
  {
    folder: 'module-01-python',
    slug: 'ds-module-01-python',
    name: 'Module 1: Python for Data Science',
    description: 'Python basics, data types, operators, functions, loops, OOPs, and exception handling',
    order: 1,
    icon: '🐍'
  },
  {
    folder: 'module-02-data-libraries',
    slug: 'ds-module-02-data-libraries',
    name: 'Module 2: Data Science Libraries',
    description: 'NumPy, Pandas, and core data wrangling techniques',
    order: 2,
    icon: '📚'
  },
  {
    folder: 'module-03-visualization',
    slug: 'ds-module-03-visualization',
    name: 'Module 3: Data Visualization',
    description: 'Matplotlib, Seaborn, Plotly, EDA, and dashboards',
    order: 3,
    icon: '📈'
  },
  {
    folder: 'module-06-statistics',
    slug: 'ds-module-06-statistics',
    name: 'Module 6: Statistics & Probability',
    description: 'Probability theory, summary statistics, and distributions',
    order: 6,
    icon: '📊'
  },
  {
    folder: 'module-07-advanced-statistics',
    slug: 'ds-module-07-advanced-statistics',
    name: 'Module 7: Advanced Statistics',
    description: 'Inference, confidence, hypothesis testing, metrics, and experiment design',
    order: 7,
    icon: '🧮'
  },
  {
    folder: 'module-08-ml-foundations',
    slug: 'ds-module-08-ml-foundations',
    name: 'Module 8: Machine Learning Foundations',
    description: 'Supervised and unsupervised learning fundamentals',
    order: 8,
    icon: '🤖'
  },
  {
    folder: 'module-09-ml-advanced',
    slug: 'ds-module-09-ml-advanced',
    name: 'Module 9: Advanced Machine Learning',
    description: 'Feature engineering, validation, bagging, boosting, NLP intro',
    order: 9,
    icon: '🧬'
  },
  {
    folder: 'module-10-ml-ops-genai',
    slug: 'ds-module-10-ml-ops-genai',
    name: 'Module 10: MLOps & GenAI',
    description: 'ML lifecycle, deployment, GenAI, LLMs, and recommender systems',
    order: 10,
    icon: '☁️'
  }
];

function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/\.ipynb$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isDataScienceCourse(course = '') {
  const c = course.toLowerCase();
  return (
    c.includes('data science') ||
    (c.includes('data') && c.includes('ai')) ||
    c === 'data science & ai' ||
    c.includes('ds&ai')
  );
}

async function upsertCategory(def) {
  const payload = {
    name: def.name,
    slug: def.slug,
    description: def.description,
    course: 'data-science-ai',
    icon: def.icon,
    displayOrder: def.order,
    visibility: 'published'
  };

  const existing = await ResourceCategory.findOne({ slug: def.slug });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }
  return ResourceCategory.create(payload);
}

async function main() {
  await connectMongo();
  const contentRoot = getContentRoot();
  const dsRoot = path.join(contentRoot, 'course-notebooks', 'data-science-ai');
  console.log('Content root:', contentRoot);
  console.log('DS notebooks root:', dsRoot);

  if (!fs.existsSync(dsRoot)) {
    throw new Error(`DS notebooks folder missing: ${dsRoot}`);
  }

  // Enable Resources for Data Science batches
  const allBatches = await Batch.find({}).exec();
  const dsBatches = allBatches.filter((b) => isDataScienceCourse(b.course || b.programLabel || ''));
  const dsBatchIds = dsBatches.map((b) => b._id);

  if (dsBatchIds.length) {
    await Batch.updateMany(
      { _id: { $in: dsBatchIds } },
      { $set: { resourcesEnabled: true, resourceUniverse: 'data-science-ai' } }
    );
  }
  console.log(`Enabled resources on ${dsBatchIds.length} Data Science batches`);

  const allO2O = await OneToOneBatch.find({}).exec();
  const dsO2O = allO2O.filter((b) => isDataScienceCourse(b.course || ''));
  const dsO2OIds = dsO2O.map((b) => String(b._id));
  if (dsO2OIds.length) {
    await OneToOneBatch.updateMany(
      { _id: { $in: dsO2O.map((b) => b._id) } },
      { $set: { resourcesEnabled: true, resourceUniverse: 'data-science-ai' } }
    );
  }
  console.log(`Enabled resources on ${dsO2OIds.length} Data Science one-to-one batches`);

  let notebookCount = 0;

  for (const def of MODULE_DEFS) {
    const moduleDir = path.join(dsRoot, def.folder);
    if (!fs.existsSync(moduleDir)) {
      console.warn('Skipping missing module folder:', def.folder);
      continue;
    }

    const category = await upsertCategory(def);
    const files = fs
      .readdirSync(moduleDir)
      .filter((f) => f.toLowerCase().endsWith('.ipynb'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const fileName of files) {
      const relativePath = path
        .join('course-notebooks', 'data-science-ai', def.folder, fileName)
        .replace(/\\/g, '/');
      const resourceSlug = `ds-nb-${def.folder}-${slugify(fileName)}`;
      const title = fileName.replace(/\.ipynb$/i, '');
      const absolute = path.join(moduleDir, fileName);
      const stat = fs.statSync(absolute);

      const payload = {
        title,
        slug: resourceSlug,
        course: 'data-science-ai',
        categoryId: category._id,
        categorySlug: def.slug,
        resourceType: 'notebook',
        description: `${def.name} notebook: ${title}`,
        difficulty: 'beginner',
        estimatedMinutes: 45,
        tags: ['notebook', 'data-science', def.folder],
        content: {
          fileUrl: relativePath,
          fileName,
          fileSizeBytes: stat.size,
          fileFormat: 'ipynb'
        },
        assignedBatches: dsBatchIds,
        assignedOneToOneBatches: dsO2OIds,
        status: 'published'
      };

      const existing = await Resource.findOne({ slug: resourceSlug });
      if (existing) {
        existing.title = payload.title;
        existing.course = payload.course;
        existing.categoryId = payload.categoryId;
        existing.categorySlug = payload.categorySlug;
        existing.resourceType = payload.resourceType;
        existing.description = payload.description;
        existing.tags = payload.tags;
        existing.content = { ...(existing.content || {}), ...payload.content };
        existing.assignedBatches = dsBatchIds;
        existing.assignedOneToOneBatches = dsO2OIds;
        existing.status = 'published';
        existing.updatedAt = new Date();
        await existing.save();
      } else {
        await Resource.create(payload);
      }
      notebookCount += 1;
    }

    console.log(`Module ${def.folder}: ${files.length} notebooks`);
  }

  console.log(`Done. Upserted ${notebookCount} notebook resources.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('seed-ds-notebooks failed:', err);
  process.exit(1);
});
