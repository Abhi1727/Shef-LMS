const { connectMongo } = require('../config/mongo');
const ResourceCategory = require('../models/ResourceCategory');

async function main() {
    await connectMongo();
    const categories = await ResourceCategory.find({}).sort({ displayOrder: 1 });
    console.log(JSON.stringify(categories, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
