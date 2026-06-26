const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');
const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');
const OneToOneBatch = require('../models/OneToOneBatch');
const Resource = require('../models/Resource');
const ResourceCategory = require('../models/ResourceCategory');
const logger = require('../utils/logger');

// Middleware to ensure database is connected
const checkDB = async (req, res, next) => {
    try {
        await connectMongo();
        next();
    } catch (err) {
        logger.error('DB Connection Error in Resources Route', { error: err.message });
        res.status(500).send('Database connection error');
    }
};

router.use(checkDB);

// ==========================================
// STUDENT ENDPOINTS
// ==========================================

// @route   GET /api/resources
// @desc    Get resources + categories mapped to user's course and batch configuration
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Admins, teachers, and mentors bypass batch enablement checks and see all resources
        const bypassCheck = ['admin', 'teacher', 'instructor', 'mentor'].includes(user.role);
        
        let resourcesEnabled = false;
        let batchId = user.batchId;
        let oneToOneBatchId = user.oneToOneBatchId;
        let batchName = '';

        if (bypassCheck) {
            resourcesEnabled = true;
        } else {
            // Check regular batch
            if (batchId) {
                const batch = await Batch.findById(batchId);
                if (batch) {
                    batchName = batch.name;
                    if (batch.resourcesEnabled) {
                        resourcesEnabled = true;
                    }
                }
            }
            // Check one-to-one batch
            if (oneToOneBatchId && !resourcesEnabled) {
                const o2oBatch = await OneToOneBatch.findById(oneToOneBatchId);
                if (o2oBatch) {
                    batchName = o2oBatch.name;
                    if (o2oBatch.resourcesEnabled) {
                        resourcesEnabled = true;
                    }
                }
            }
        }

        if (!resourcesEnabled) {
            return res.json({ 
                resourcesEnabled: false, 
                message: `Resources Center is not activated for your batch (${batchName || 'No Batch Assigned'}) yet. Please request activation from your instructor.` 
            });
        }

        // Determine course content universe
        // Handle "Cyber Security & Ethical Hacking" vs "Data Science & AI"
        let activeUniverse = 'data-science-ai'; // fallback default
        let isDualUniverse = false;
        const userCourse = (user.course || '').toLowerCase();

        if (userCourse.includes('cyber') && (userCourse.includes('ai') || userCourse.includes('data science'))) {
            activeUniverse = 'both';
            isDualUniverse = true;
        } else if (userCourse.includes('cyber') || userCourse.includes('ethical')) {
            activeUniverse = 'cyber-security';
        } else if (userCourse.includes('data') || userCourse.includes('ai') || userCourse.includes('intelligence')) {
            activeUniverse = 'data-science-ai';
        }

        // If explicitly set, respect user model's enrolledCourse
        if (user.enrolledCourse) {
            activeUniverse = user.enrolledCourse;
            if (activeUniverse === 'both') {
                isDualUniverse = true;
            }
        }

        // Apply batch-level overrides if specified by the admin
        if (!bypassCheck) {
            if (batchId) {
                const batch = await Batch.findById(batchId);
                if (batch && batch.resourceUniverse) {
                    activeUniverse = batch.resourceUniverse;
                    isDualUniverse = (batch.resourceUniverse === 'both');
                }
            } else if (oneToOneBatchId) {
                const o2oBatch = await OneToOneBatch.findById(oneToOneBatchId);
                if (o2oBatch && o2oBatch.resourceUniverse) {
                    activeUniverse = o2oBatch.resourceUniverse;
                    isDualUniverse = (o2oBatch.resourceUniverse === 'both');
                }
            }
        }

        // Build resources query
        let resourceQuery = { status: 'published' };
        
        // Filter by course universe if not admin/teacher
        if (!bypassCheck) {
            if (activeUniverse !== 'both') {
                resourceQuery.course = { $in: [activeUniverse, 'both'] };
            }
            
            // Only show resources assigned to their specific batch or 1:1 batch
            const batchMatchConditions = [];
            if (batchId) batchMatchConditions.push({ assignedBatches: batchId });
            if (oneToOneBatchId) batchMatchConditions.push({ assignedOneToOneBatches: String(oneToOneBatchId) });
            
            if (batchMatchConditions.length > 0) {
                resourceQuery.$or = batchMatchConditions;
            } else {
                // If student has no batches, they see nothing
                return res.json({
                    resourcesEnabled: true,
                    isDualUniverse,
                    activeUniverse,
                    categories: [],
                    resources: []
                });
            }
        } else {
            // For admin/teacher, if a specific universe query param is passed, filter by it
            const targetUniverse = req.query.universe;
            if (targetUniverse && targetUniverse !== 'both') {
                resourceQuery.course = { $in: [targetUniverse, 'both'] };
            }
        }

        // Fetch categories matching course
        let categoryQuery = { visibility: 'published' };
        if (!bypassCheck && activeUniverse !== 'both') {
            categoryQuery.course = { $in: [activeUniverse, 'both'] };
        }

        const [categories, resources] = await Promise.all([
            ResourceCategory.find(categoryQuery).sort({ displayOrder: 1, name: 1 }).exec(),
            Resource.find(resourceQuery).populate('categoryId').sort({ createdAt: -1 }).exec()
        ]);

        res.json({
            resourcesEnabled: true,
            isDualUniverse,
            activeUniverse,
            categories,
            resources
        });
    } catch (err) {
        logger.error('Error fetching resources', { error: err.message });
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/resources/toolkit-explorer
// @desc    Get toolkit board data for Cyber Security
// @access  Private
router.get('/toolkit-explorer', auth, async (req, res) => {
    try {
        const query = { 
            status: 'published',
            course: { $in: ['cyber-security', 'both'] },
            resourceType: 'tool'
        };
        const tools = await Resource.find(query).sort({ title: 1 }).exec();
        res.json(tools);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/resources/:slug
// @desc    Get detailed resource view (increments counter)
// @access  Private
router.get('/:slug', auth, async (req, res) => {
    try {
        const resource = await Resource.findOne({ slug: req.params.slug })
            .populate('categoryId')
            .populate('content.relatedToolIds')
            .exec();

        if (!resource) {
            return res.status(404).json({ message: 'Resource not found' });
        }

        // Increment views
        resource.views += 1;
        await resource.save();

        res.json(resource);
    } catch (err) {
        logger.error('Error fetching resource details', { error: err.message });
        res.status(500).send('Server error');
    }
});


// ==========================================
// ADMIN & TEACHER ENDPOINTS
// ==========================================

// @route   GET /api/admin/resources
// @desc    Get all resources for management table
// @access  Private (Admin/Teacher)
router.get('/admin/list', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!['admin', 'teacher', 'instructor', 'mentor'].includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const resources = await Resource.find().populate('categoryId').sort({ createdAt: -1 }).exec();
        res.json(resources);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST /api/admin/resources
// @desc    Create a new resource
// @access  Private (Admin/Teacher)
router.post('/admin/create', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!['admin', 'teacher', 'instructor', 'mentor'].includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const resourceData = req.body;
        
        // Generate fallback slug
        if (!resourceData.slug) {
            resourceData.slug = resourceData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        }

        const resource = new Resource(resourceData);
        await resource.save();
        res.status(201).json(resource);
    } catch (err) {
        logger.error('Create resource error', { error: err.message });
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// @route   PUT /api/admin/resources/:id
// @desc    Update a resource
// @access  Private (Admin/Teacher)
router.put('/admin/update/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!['admin', 'teacher', 'instructor', 'mentor'].includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const updated = await Resource.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: new Date() },
            { new: true }
        );

        if (!updated) return res.status(404).json({ message: 'Resource not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// @route   DELETE /api/admin/resources/:id
// @desc    Delete a resource
// @access  Private (Admin/Teacher)
router.delete('/admin/delete/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!['admin', 'teacher', 'instructor', 'mentor'].includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const deleted = await Resource.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Resource not found' });
        res.json({ message: 'Resource deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/admin/batches/:batchId/resources/:resourceId
// @desc    Link resource to batch
// @access  Private (Admin/Teacher)
router.put('/admin/batches/:batchId/resources/:resourceId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!['admin', 'teacher', 'instructor', 'mentor'].includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { batchId, resourceId } = req.params;
        const { isOneToOne } = req.body; // boolean

        const resource = await Resource.findById(resourceId);
        if (!resource) return res.status(404).json({ message: 'Resource not found' });

        if (isOneToOne) {
            if (!resource.assignedOneToOneBatches.includes(String(batchId))) {
                resource.assignedOneToOneBatches.push(String(batchId));
            }
        } else {
            if (!resource.assignedBatches.includes(batchId)) {
                resource.assignedBatches.push(batchId);
            }
        }

        await resource.save();
        res.json({ message: 'Resource successfully assigned to batch', resource });
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// @route   DELETE /api/admin/batches/:batchId/resources/:resourceId
// @desc    Unassign resource from batch
// @access  Private (Admin/Teacher)
router.delete('/admin/batches/:batchId/resources/:resourceId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!['admin', 'teacher', 'instructor', 'mentor'].includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { batchId, resourceId } = req.params;
        const { isOneToOne } = req.body; // pass in body or auto detect

        const resource = await Resource.findById(resourceId);
        if (!resource) return res.status(404).json({ message: 'Resource not found' });

        if (isOneToOne || resource.assignedOneToOneBatches.includes(String(batchId))) {
            resource.assignedOneToOneBatches = resource.assignedOneToOneBatches.filter(id => id !== String(batchId));
        }
        resource.assignedBatches = resource.assignedBatches.filter(id => String(id) !== String(batchId));

        await resource.save();
        res.json({ message: 'Resource successfully unassigned from batch', resource });
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});


// ==========================================
// SEEDING ENDPOINT
// ==========================================

// @route   POST /api/resources/seed
// @desc    Seeds initial mock categories and resources
// @access  Private (Admin only)
router.post('/seed/all', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admin can seed data' });
        }

        // Clean out existing ResourceCategories and Resources to ensure freshness
        await ResourceCategory.deleteMany({});
        await Resource.deleteMany({});

        // 1. Seed Categories
        const categoriesData = [
            // Data Science & AI Modules
            { name: 'Module 1. Python for Data Science', slug: 'python-fundamentals', description: 'Core Python syntax, loops, functions, variables, OOPs, and stack execution', course: 'data-science-ai', displayOrder: 1, icon: '🐍', driveFolderUrl: 'https://drive.google.com/drive/folders/1iarmcAP5aJeYKvFq6KgR2Lcgk_kxpqNT?usp=drive_link' },
            { name: 'Module 2. Data Science Libraries', slug: 'data-analysis', description: 'Scientific computing and tables using NumPy, Pandas, Matplotlib, and Seaborn', course: 'data-science-ai', displayOrder: 2, icon: '📈', driveFolderUrl: 'https://drive.google.com/drive/folders/1yAqYLlA86XJuAthC_WaBdSXI8smDLiO-?usp=drive_link' },
            { name: 'Module 3. Exploratory Data Analysis (EDA)', slug: 'eda-data', description: 'Exploratory Data Analysis, variable profiles, and visualization tips', course: 'data-science-ai', displayOrder: 3, icon: '🔍', driveFolderUrl: 'https://drive.google.com/drive/folders/15Hht1GDHAjiHhzh1CJGmifBtT6_A44u4?usp=drive_link' },
            { name: 'Module 4. SQL for Data Science', slug: 'mysql', description: 'Relational database architecture, schemas, and complex JOIN operations', course: 'data-science-ai', displayOrder: 4, icon: '🐬', driveFolderUrl: 'https://drive.google.com/drive/folders/1hKbAINd8ME8IYLUEEsy9nkWn12u_effP?usp=drive_link' },
            { name: 'Module 5. Business Intelligence (PowerBI & Tableau)', slug: 'bi-tools', description: 'BI visualization worksheets, dashboards, and navigation flows', course: 'data-science-ai', displayOrder: 5, icon: '📊', driveFolderUrl: 'https://drive.google.com/drive/folders/1Obi_FPfMX6ZizuSHTJUE6sTvh6gXaNzb?usp=drive_link' },
            { name: 'Module 6. Statistics & Probability for Data Science', slug: 'statistics-mathematics', description: 'Descriptive/inferential statistics, normal distribution, z-scores, hypothesis testing', course: 'data-science-ai', displayOrder: 6, icon: '📊', driveFolderUrl: 'https://drive.google.com/drive/folders/1JgiKs3PeoNQ11_GrtWbjOjH15LokQ1qS?usp=drive_link' },
            { name: 'Module 7. Advanced Statistics for Data Science', slug: 'advanced-statistics', description: 'Advanced confidence intervals, hypothesis tests, and business metrics', course: 'data-science-ai', displayOrder: 7, icon: '🎯', driveFolderUrl: 'https://drive.google.com/drive/folders/1YmAKfcVz0BhSly21OPaphQPJBthERUPE?usp=drive_link' },
            { name: 'Module 8. Machine Learning & it\'s Classification', slug: 'supervised-learning', description: 'Regression, classification, decision boundaries, SVMs, and Ensemble Trees', course: 'data-science-ai', displayOrder: 8, icon: '🤖', driveFolderUrl: 'https://drive.google.com/drive/folders/1W8MeeNOC4f4cAsYU9kxiL6s_7jU1hSoO?usp=drive_link' },
            { name: 'Module 9. Model Optimization & Deep Learning', slug: 'deep-learning-ai', description: 'Artificial Neural Networks, backpropagation, CNN maps, and unrolled sequences', course: 'data-science-ai', displayOrder: 9, icon: '🧠', driveFolderUrl: 'https://drive.google.com/drive/folders/1SRKkuzNoLw4ScXY-R4jR_MQ8o0DgbjMn?usp=drive_link' },
            { name: 'Module 10. GenAI & MLOps', slug: 'nlp-mlops', description: 'Attention transformers, tokenizers, MLflow tracking, and Docker deployment', course: 'data-science-ai', displayOrder: 10, icon: '☁️', driveFolderUrl: 'https://drive.google.com/drive/folders/1br64KjS7uU-HUDAazbT35YFDnaqDlbMF?usp=drive_link' },
            
            // Cyber Security Phases
            { name: 'Reconnaissance & OSINT', slug: 'reconnaissance-osint', description: 'Information gathering and footprints', course: 'cyber-security', displayOrder: 1, icon: '🔍' },
            { name: 'Network Scanning', slug: 'network-scanning', description: 'Nmap sweeps and active host detection', course: 'cyber-security', displayOrder: 2, icon: '📡' },
            { name: 'Privilege Escalation', slug: 'privilege-escalation', description: 'Gaining root/system authority', course: 'cyber-security', displayOrder: 3, icon: '🔑' }
        ];

        const insertedCats = await ResourceCategory.insertMany(categoriesData);
        
        // Find category ids
        const catMap = {};
        insertedCats.forEach(c => {
            catMap[c.slug] = c._id;
        });

        // Fetch any existing batch so we can assign these seeded resources to them, 
        // ensuring they show up in the students' resources view.
        const allBatches = await Batch.find().exec();
        const allO2OBatches = await OneToOneBatch.find().exec();
        const batchIds = allBatches.map(b => b._id);
        const o2oBatchIds = allO2OBatches.map(b => String(b._id));

        // 2. Seed Resources
        const resourcesData = [
            {
                title: 'Module 1 Materials (Google Drive)',
                slug: 'module-1-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['python-fundamentals'],
                categorySlug: 'python-fundamentals',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 1.',
                difficulty: 'beginner',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'python'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/1iarmcAP5aJeYKvFq6KgR2Lcgk_kxpqNT?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Module 2 Materials (Google Drive)',
                slug: 'module-2-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['statistics-mathematics'],
                categorySlug: 'statistics-mathematics',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 2.',
                difficulty: 'beginner',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'statistics'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/1yAqYLlA86XJuAthC_WaBdSXI8smDLiO-?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Module 3 Materials (Google Drive)',
                slug: 'module-3-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['data-analysis'],
                categorySlug: 'data-analysis',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 3.',
                difficulty: 'intermediate',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'data-analysis'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/15Hht1GDHAjiHhzh1CJGmifBtT6_A44u4?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Module 4 Materials (Google Drive)',
                slug: 'module-4-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['supervised-learning'],
                categorySlug: 'supervised-learning',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 4.',
                difficulty: 'intermediate',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'machine-learning'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/1hKbAINd8ME8IYLUEEsy9nkWn12u_effP?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Module 5 Materials (Google Drive)',
                slug: 'module-5-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['unsupervised-learning'],
                categorySlug: 'unsupervised-learning',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 5.',
                difficulty: 'intermediate',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'machine-learning'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/1Obi_FPfMX6ZizuSHTJUE6sTvh6gXaNzb?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Module 6 Materials (Google Drive)',
                slug: 'module-6-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['deep-learning-ai'],
                categorySlug: 'deep-learning-ai',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 6.',
                difficulty: 'advanced',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'deep-learning'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/1JgiKs3PeoNQ11_GrtWbjOjH15LokQ1qS?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Module 7 Materials (Google Drive)',
                slug: 'module-7-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['mysql'],
                categorySlug: 'mysql',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 7.',
                difficulty: 'beginner',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'mysql'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/1YmAKfcVz0BhSly21OPaphQPJBthERUPE?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Module 8 Materials (Google Drive)',
                slug: 'module-8-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['tableau'],
                categorySlug: 'tableau',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 8.',
                difficulty: 'beginner',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'tableau'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/1W8MeeNOC4f4cAsYU9kxiL6s_7jU1hSoO?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Module 9 Materials (Google Drive)',
                slug: 'module-9-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['power-bi'],
                categorySlug: 'power-bi',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 9.',
                difficulty: 'intermediate',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'power-bi'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/1SRKkuzNoLw4ScXY-R4jR_MQ8o0DgbjMn?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Module 10 Materials (Google Drive)',
                slug: 'module-10-drive-folder',
                course: 'data-science-ai',
                categoryId: catMap['data-engineering'],
                categorySlug: 'data-engineering',
                resourceType: 'external-link',
                description: 'Access the official Google Drive class materials, datasets, and guides for Module 10.',
                difficulty: 'advanced',
                estimatedMinutes: 5,
                tags: ['google-drive', 'class-materials', 'data-engineering'],
                content: {
                    externalUrl: 'https://drive.google.com/drive/folders/1br64KjS7uU-HUDAazbT35YFDnaqDlbMF?usp=drive_link'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Python Variable Mutability Playground',
                slug: 'python-variable-mutability',
                course: 'data-science-ai',
                categoryId: catMap['python-fundamentals'],
                categorySlug: 'python-fundamentals',
                resourceType: 'notebook',
                description: 'Verify variable assignment, memory addresses, lists, and tuples.',
                difficulty: 'beginner',
                estimatedMinutes: 20,
                tags: ['python', 'mutability', 'tuples'],
                content: {
                    colabUrl: 'https://colab.research.google.com/notebooks/intro.ipynb'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Z-Score Normal Curve Calculator',
                slug: 'z-score-normal-curve',
                course: 'data-science-ai',
                categoryId: catMap['statistics-mathematics'],
                categorySlug: 'statistics-mathematics',
                resourceType: 'cheat-sheet',
                description: 'Gaussian probability densities, tails, and cumulative bounds.',
                difficulty: 'beginner',
                estimatedMinutes: 15,
                tags: ['statistics', 'z-score', 'math'],
                content: {
                    richText: '<h3>Z-Score Formula</h3><p>Z = (X - μ) / σ</p>'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Data Exploration with Pandas and NumPy',
                slug: 'data-exploration-pandas',
                course: 'data-science-ai',
                categoryId: catMap['data-analysis'],
                categorySlug: 'data-analysis',
                resourceType: 'dataset',
                description: 'A walkthrough dataset mapping arrays, columns, indexing, and aggregations.',
                difficulty: 'intermediate',
                estimatedMinutes: 30,
                tags: ['pandas', 'numpy', 'data-cleaning'],
                content: {
                    fileName: 'exploration_sample.csv',
                    fileFormat: 'csv'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Gradient Descent Loss Optimization',
                slug: 'gradient-descent-loss',
                course: 'data-science-ai',
                categoryId: catMap['supervised-learning'],
                categorySlug: 'supervised-learning',
                resourceType: 'notes',
                description: 'Study momentum paths, SGD, and learning rate impact on loss convergence.',
                difficulty: 'intermediate',
                estimatedMinutes: 25,
                tags: ['optimization', 'gradient-descent', 'ml'],
                content: {
                    richText: '<h3>Loss Optimization</h3><p>Updates: θ = θ - η * ∇J(θ)</p>'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Lloyds K-Means Convergence Sandbox',
                slug: 'k-means-convergence-sandbox',
                course: 'data-science-ai',
                categoryId: catMap['unsupervised-learning'],
                categorySlug: 'unsupervised-learning',
                resourceType: 'lab',
                description: 'Step-by-step Lloyd\'s clustering updates, random seeding, and inertia metrics.',
                difficulty: 'intermediate',
                estimatedMinutes: 30,
                tags: ['clustering', 'kmeans', 'unsupervised'],
                content: {
                    richText: '<h3>K-Means Target</h3><p>Minimize Sum of Squared Distances to Centroids.</p>'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'ANN Architect & Boilerplate Generator',
                slug: 'ann-architect-boilerplate',
                course: 'data-science-ai',
                categoryId: catMap['deep-learning-ai'],
                categorySlug: 'deep-learning-ai',
                resourceType: 'cheat-sheet',
                description: 'Construct custom multi-layer networks and count trainable weight parameters.',
                difficulty: 'advanced',
                estimatedMinutes: 25,
                tags: ['ann', 'parameters', 'deep-learning'],
                content: {
                    richText: '<h3>ANN parameters</h3><p>weights = input_units * output_units; biases = output_units</p>'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'MySQL JOIN Operations Visualizer',
                slug: 'mysql-joins-visualizer',
                course: 'data-science-ai',
                categoryId: catMap['mysql'],
                categorySlug: 'mysql',
                resourceType: 'notes',
                description: 'A comprehensive visual guide to SQL INNER, LEFT, RIGHT, and OUTER JOINs.',
                difficulty: 'beginner',
                estimatedMinutes: 15,
                tags: ['mysql', 'joins', 'sql'],
                content: {
                    richText: '<h3>SQL JOIN Venn Logic</h3><p>Combines records from two tables based on a matching key.</p>'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Data Ingestion and Airflow DAGs',
                slug: 'airflow-dags-ingestion',
                course: 'data-science-ai',
                categoryId: catMap['data-engineering'],
                categorySlug: 'data-engineering',
                resourceType: 'project',
                description: 'Orchestrating ETL pipelines using Apache Airflow Directed Acyclic Graphs.',
                difficulty: 'advanced',
                estimatedMinutes: 40,
                tags: ['airflow', 'etl', 'data-engineering'],
                content: {
                    richText: '<h3>ETL Orchestration</h3><p>Extract, Transform, and Load schedules mapped inside DAG structures.</p>'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            {
                title: 'Transformer Attention Weights and Tokenizers',
                slug: 'transformer-attention-weights',
                course: 'data-science-ai',
                categoryId: catMap['nlp-mlops'],
                categorySlug: 'nlp-mlops',
                resourceType: 'notes',
                description: 'Sinusoidal positional encoding, BPE tokenization, and self-attention mapping matrix.',
                difficulty: 'advanced',
                estimatedMinutes: 35,
                tags: ['nlp', 'transformers', 'attention'],
                content: {
                    richText: '<h3>Attention Matrix</h3><p>Attention(Q,K,V) = Softmax(Q Kᵀ / √d) V</p>'
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            },
            
            // Cyber Security
            {
                title: 'Nmap Scanning & Flag Commands Reference',
                slug: 'nmap-commands-reference',
                course: 'cyber-security',
                categoryId: catMap['network-scanning'],
                categorySlug: 'network-scanning',
                resourceType: 'tool',
                description: 'Full commands cheatsheet for TCP connect, SYN stealth scans, and OS discovery.',
                difficulty: 'beginner',
                estimatedMinutes: 20,
                tags: ['nmap', 'scanning', 'network', 'recon'],
                content: {
                    officialUrl: 'https://nmap.org',
                    githubUrl: 'https://github.com/nmap/nmap',
                    platforms: ['linux', 'windows', 'macos'],
                    installationGuide: {
                        linux: 'sudo apt update && sudo apt install nmap -y',
                        macos: 'brew install nmap'
                    },
                    commands: [
                        {
                            command: 'nmap -sS -p- <target_ip>',
                            description: 'Executes a stealth SYN scan against all 65,535 TCP ports.',
                            flags: [{ flag: '-sS', description: 'SYN Scan' }, { flag: '-p-', description: 'All ports' }],
                            useCase: 'Host Discovery'
                        }
                    ]
                },
                assignedBatches: batchIds,
                assignedOneToOneBatches: o2oBatchIds
            }
        ];

        await Resource.insertMany(resourcesData);

        res.json({ message: 'Database successfully seeded with categories and assigned resources!' });
    } catch (err) {
        logger.error('Seeding error', { error: err.message });
        res.status(500).json({ message: 'Seeding failed: ' + err.message });
    }
});

module.exports = router;
