const { db } = require('./config/firebase');
require('dotenv').config();

async function cleanUpClassroomData() {
  try {
    console.log('🧹 Starting comprehensive classroom data cleanup...\n');
    
    // Get all documents
    const snapshot = await db.collection('classroom').get();
    
    if (snapshot.empty) {
      console.log('📭 No documents found in classroom collection');
      return;
    }
    
    console.log(`📊 Found ${snapshot.size} documents to analyze\n`);
    
    let deletedCount = 0;
    let failedCount = 0;
    let keptCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      
      // Delete if:
      // 1. No video source OR empty video source
      // 2. Title contains "Personal Meeting Room" (these are auto-generated duplicates)
      // 3. No meaningful content (no title, no instructor, no URLs)
      
      const shouldDelete = 
        !data.videoSource || 
        data.videoSource === 'No video source' ||
        (data.title && data.title.includes('Personal Meeting Room')) ||
        (!data.title || data.title.trim() === '') ||
        (data.instructor === 'Instructor' && !data.zoomUrl && !data.driveId && !data.youtubeVideoUrl);
      
      if (shouldDelete) {
        try {
          await doc.ref.delete();
          console.log(`🗑️ Deleted: ${docId} - ${data.title || 'No title'}`);
          deletedCount++;
        } catch (error) {
          console.error(`❌ Failed to delete ${docId}:`, error);
          failedCount++;
        }
      } else {
        console.log(`✅ Kept: ${docId} - ${data.title || 'No title'} (${data.videoSource || 'no source'})`);
        keptCount++;
      }
    }
    
    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   ✅ Successfully deleted: ${deletedCount} documents`);
    console.log(`   ❌ Failed to delete: ${failedCount} documents`);
    console.log(`   📋 Kept: ${keptCount} documents`);
    console.log(`   📈 Total processed: ${snapshot.size} documents`);
    
    // Show remaining documents
    if (keptCount > 0) {
      console.log(`\n📋 Remaining documents:`);
      const remainingSnapshot = await db.collection('classroom').get();
      remainingSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`   📹 ${data.title || 'No title'} (${data.videoSource || 'no source'}) - ${doc.id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

async function deleteByTitlePattern(pattern) {
  try {
    console.log(`🗑️ Deleting documents with title pattern: ${pattern}`);
    
    const snapshot = await db.collection('classroom').get();
    
    if (snapshot.empty) {
      console.log('📭 No documents found');
      return;
    }
    
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const title = data.title || '';
      
      if (title.includes(pattern)) {
        try {
          await doc.ref.delete();
          console.log(`✅ Deleted: ${doc.id} - ${title}`);
          deletedCount++;
        } catch (error) {
          console.error(`❌ Failed to delete ${doc.id}:`, error);
          failedCount++;
        }
      }
    }
    
    console.log(`\n📊 Deletion Summary for pattern "${pattern}":`);
    console.log(`   ✅ Successfully deleted: ${deletedCount} documents`);
    console.log(`   ❌ Failed to delete: ${failedCount} documents`);
    
  } catch (error) {
    console.error(`❌ Error deleting documents with pattern "${pattern}":`, error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'cleanup':
        await cleanUpClassroomData();
        break;
        
      case 'delete-pattern':
        const pattern = args[1];
        if (!pattern) {
          console.log('❌ Please specify a pattern: node cleanup-classroom.js delete-pattern <pattern>');
          console.log('   Example: node cleanup-classroom.js delete-pattern "Personal Meeting Room"');
          return;
        }
        await deleteByTitlePattern(pattern);
        break;
        
      default:
        console.log('🧹 Classroom Data Cleanup Tool');
        console.log('');
        console.log('Usage:');
        console.log('  node cleanup-classroom.js cleanup                    - Smart cleanup of junk data');
        console.log('  node cleanup-classroom.js delete-pattern <pattern>     - Delete by title pattern');
        console.log('');
        console.log('Smart cleanup removes:');
        console.log('  - Documents with no video source');
        console.log('  - "Personal Meeting Room" entries');
        console.log('  - Documents with no meaningful content');
        break;
    }
  } catch (error) {
    console.error('❌ Operation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  cleanUpClassroomData,
  deleteByTitlePattern
};
