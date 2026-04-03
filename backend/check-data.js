const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shef-lms')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Check all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Check each collection for data
    for (const collection of collections) {
      const coll = mongoose.connection.db.collection(collection.name);
      const count = await coll.countDocuments();
      console.log(`${collection.name}: ${count} documents`);
      
      if (count > 0 && count <= 5) {
        const samples = await coll.find({}).limit(2).toArray();
        console.log(`Sample data from ${collection.name}:`, JSON.stringify(samples, null, 2));
      }
    }
    
    await mongoose.connection.close();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
