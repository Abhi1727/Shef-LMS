const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');
const OneToOneBatch = require('../models/OneToOneBatch');
const Resource = require('../models/Resource');
const ResourceCategory = require('../models/ResourceCategory');

async function seed() {
    console.log('Connecting to MongoDB...');
    await connectMongo();
    console.log('Connected!');

    console.log('Cleaning old resource collections...');
    await ResourceCategory.deleteMany({});
    await Resource.deleteMany({});

    console.log('Seeding categories...');
    const categoriesData = [
        // Data Science & AI Modules
        { name: 'MODULE 1: Python Fundamentals', slug: 'python-fundamentals', description: 'Core Python syntax, loops, functions, variables, OOPs, and stack execution', course: 'data-science-ai', displayOrder: 1, icon: '🐍' },
        { name: 'MODULE 2: Statistics & Mathematics', slug: 'statistics-mathematics', description: 'Descriptive/inferential statistics, normal distribution, z-scores, hypothesis testing', course: 'data-science-ai', displayOrder: 2, icon: '📊' },
        { name: 'MODULE 3: Data Analysis', slug: 'data-analysis', description: 'Scientific computing and tables using NumPy, Pandas, Matplotlib, and Seaborn', course: 'data-science-ai', displayOrder: 3, icon: '📈' },
        { name: 'MODULE 4: Machine Learning — Supervised', slug: 'supervised-learning', description: 'Regression, classification, decision boundaries, SVMs, and Ensemble Trees', course: 'data-science-ai', displayOrder: 4, icon: '🤖' },
        { name: 'MODULE 5: Machine Learning — Unsupervised', slug: 'unsupervised-learning', description: 'Clustering convergence (K-Means, hierarchical) and dimensionality reduction (PCA)', course: 'data-science-ai', displayOrder: 5, icon: '🧬' },
        { name: 'MODULE 6: Deep Learning & AI', slug: 'deep-learning-ai', description: 'Artificial Neural Networks, backpropagation, CNN maps, and unrolled sequences', course: 'data-science-ai', displayOrder: 6, icon: '🧠' },
        { name: 'MODULE 7: MySQL', slug: 'mysql', description: 'Relational database architecture, schemas, and complex JOIN operations', course: 'data-science-ai', displayOrder: 7, icon: '🐬' },
        { name: 'MODULE 8: Tableau', slug: 'tableau', description: 'BI visualization worksheets, dashboards, and navigation flows', course: 'data-science-ai', displayOrder: 8, icon: '🎨' },
        { name: 'MODULE 9: Power BI & Google Data Studio', slug: 'power-bi', description: 'Cross-highlighting report building and interactive slicing controls', course: 'data-science-ai', displayOrder: 9, icon: '📊' },
        { name: 'MODULE 10: Data Engineering', slug: 'data-engineering', description: 'ETL pipelines, data lakes, warehouses, Airflow DAGs, and storage', course: 'data-science-ai', displayOrder: 10, icon: '⚙️' },
        { name: 'MODULE 11: NLP with MLOps', slug: 'nlp-mlops', description: 'Attention transformers, tokenizers, MLflow tracking, and Docker deployment', course: 'data-science-ai', displayOrder: 11, icon: '☁️' },
        { name: 'MODULE 12: AI Strategy', slug: 'ai-strategy', description: 'A/B testing, deployment ROI, compliance, security, and LLM governance', course: 'data-science-ai', displayOrder: 12, icon: '🎯' },
        
        // Cyber Security Phases
        { name: 'Reconnaissance & OSINT', slug: 'reconnaissance-osint', description: 'Information gathering and footprints', course: 'cyber-security', displayOrder: 1, icon: '🔍' },
        { name: 'Network Scanning', slug: 'network-scanning', description: 'Nmap sweeps and active host detection', course: 'cyber-security', displayOrder: 2, icon: '📡' },
        { name: 'Privilege Escalation', slug: 'privilege-escalation', description: 'Gaining root/system authority', course: 'cyber-security', displayOrder: 3, icon: '🔑' }
    ];

    const insertedCats = await ResourceCategory.insertMany(categoriesData);
    console.log(`Inserted ${insertedCats.length} categories.`);

    const catMap = {};
    insertedCats.forEach(c => {
        catMap[c.slug] = c._id;
    });

    console.log('Fetching cohorts (Batches & OneToOneBatches) to link...');
    const allBatches = await Batch.find().exec();
    const allO2OBatches = await OneToOneBatch.find().exec();
    const batchIds = allBatches.map(b => b._id);
    const o2oBatchIds = allO2OBatches.map(b => String(b._id));

    // Also auto-activate resources for these batches so they can test immediately
    console.log('Enabling Resources Center access across all batches...');
    await Batch.updateMany({}, { $set: { resourcesEnabled: true } });
    await OneToOneBatch.updateMany({}, { $set: { resourcesEnabled: true } });

    console.log('Seeding resources...');
    const resourcesData = [
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

    const insertedRes = await Resource.insertMany(resourcesData);
    console.log(`Inserted ${insertedRes.length} resources successfully.`);

    console.log('Seeding completed successfully!');
    process.exit(0);
}

seed().catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
});
