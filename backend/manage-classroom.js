const { connectMongo } = require('./config/mongo');
const Classroom = require('./models/Classroom');
require('dotenv').config();

async function viewClassroomData() {
  try {
    console.log('🔍 Fetching all classroom documents...\n');

    await connectMongo();

    const documents = await Classroom.find({}).exec();

    if (!documents.length) {
      console.log('📭 No documents found in classroom collection');
      return;
    }

    console.log(`📊 Found ${documents.length} documents in classroom collection:\n`);

    const result = [];

    documents.forEach((doc, index) => {
      const docData = doc.toObject();

      console.log(`📹 Document ${index + 1}:`);
      console.log(`   ID: ${doc._id.toString()}`);
      console.log(`   Title: ${docData.title || 'No title'}`);
      console.log(`   Instructor: ${docData.instructor || 'No instructor'}`);
      console.log(`   Course Type: ${docData.courseType || 'No course type'}`);
      console.log(`   Video Source: ${docData.videoSource || 'No video source'}`);
      console.log(`   YouTube Video ID: ${docData.youtubeVideoId || 'No YouTube ID'}`);
      console.log(`   YouTube URL: ${docData.youtubeVideoUrl || 'No YouTube URL'}`);
      console.log(`   Zoom URL: ${docData.zoomUrl || 'No Zoom URL'}`);
      console.log(`   Drive ID: ${docData.driveId || 'No Drive ID'}`);
      console.log(`   Created: ${docData.createdAt || 'No created date'}`);
      console.log(`   Date: ${docData.date || 'No date'}`);
      console.log('   ---');

      result.push({
        id: doc._id.toString(),
        ...docData
      });
    });

    return result;
  } catch (error) {
    console.error('❌ Error fetching classroom data:', error);
    throw error;
  }
}

async function deleteClassroomDocument(docId) {
  try {
    console.log(`🗑️ Deleting document: ${docId}`);

    await connectMongo();
    await Classroom.findByIdAndDelete(docId);

    console.log(`✅ Successfully deleted document: ${docId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting document ${docId}:`, error);
    return false;
  }
}

async function deleteAllClassroomDocuments() {
  try {
    console.log('🗑️ Deleting ALL classroom documents...');

    await connectMongo();

    const documents = await Classroom.find({}).exec();

    if (!documents.length) {
      console.log('📭 No documents to delete');
      return;
    }
    
    let deletedCount = 0;
    let failedCount = 0;

    for (const doc of documents) {
      try {
        await Classroom.findByIdAndDelete(doc._id);
        console.log(`✅ Deleted: ${doc._id.toString()}`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Failed to delete ${doc._id.toString()}:`, error);
        failedCount++;
      }
    }

    console.log(`\n📊 Deletion Summary:`);
    console.log(`   ✅ Successfully deleted: ${deletedCount} documents`);
    console.log(`   ❌ Failed to delete: ${failedCount} documents`);
    
  } catch (error) {
    console.error('❌ Error deleting all classroom documents:', error);
    throw error;
  }
}

async function deleteByVideoSource(videoSource) {
  try {
    console.log(`🗑️ Deleting documents with videoSource: ${videoSource}`);

    await connectMongo();

    const documents = await Classroom.find({ videoSource }).exec();

    if (!documents.length) {
      console.log(`📭 No documents found with videoSource: ${videoSource}`);
      return;
    }
    
    let deletedCount = 0;
    let failedCount = 0;

    for (const doc of documents) {
      try {
        await Classroom.findByIdAndDelete(doc._id);
        console.log(`✅ Deleted: ${doc._id.toString()} (${doc.title})`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Failed to delete ${doc._id.toString()}:`, error);
        failedCount++;
      }
    }
    
    console.log(`\n📊 Deletion Summary for ${videoSource}:`);
    console.log(`   ✅ Successfully deleted: ${deletedCount} documents`);
    console.log(`   ❌ Failed to delete: ${failedCount} documents`);
    
  } catch (error) {
    console.error(`❌ Error deleting documents with videoSource ${videoSource}:`, error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'view':
        await viewClassroomData();
        break;
        
      case 'delete-all':
        console.log('⚠️  WARNING: This will delete ALL classroom documents!');
        console.log('Type "DELETE ALL" to confirm:');
        
        // For safety, require confirmation
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        rl.question('Confirmation: ', async (answer) => {
          if (answer === 'DELETE ALL') {
            await deleteAllClassroomDocuments();
          } else {
            console.log('❌ Operation cancelled - confirmation not matched');
          }
          rl.close();
        });
        break;
        
      case 'delete-source':
        const videoSource = args[1];
        if (!videoSource) {
          console.log('❌ Please specify a video source: node manage-classroom.js delete-source <source>');
          console.log('   Examples: firebase, youtube-url, zoom, drive');
          return;
        }
        await deleteByVideoSource(videoSource);
        break;
        
      case 'delete-id':
        const docId = args[1];
        if (!docId) {
          console.log('❌ Please specify a document ID: node manage-classroom.js delete-id <docId>');
          console.log('   Use "node manage-classroom.js view" to see all document IDs');
          return;
        }
        await deleteClassroomDocument(docId);
        break;
        
      default:
        console.log('📋 Classroom Data Management Tool');
        console.log('');
        console.log('Usage:');
        console.log('  node manage-classroom.js view                    - View all classroom documents');
        console.log('  node manage-classroom.js delete-all              - Delete ALL documents (requires confirmation)');
        console.log('  node manage-classroom.js delete-source <source>   - Delete by video source');
        console.log('  node manage-classroom.js delete-id <docId>        - Delete specific document');
        console.log('');
        console.log('Common video sources:');
        console.log('  - firebase (uploaded videos)');
        console.log('  - youtube-url (YouTube URL videos)');
        console.log('  - zoom (Zoom recordings)');
        console.log('  - drive (Google Drive videos)');
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
  viewClassroomData,
  deleteClassroomDocument,
  deleteAllClassroomDocuments,
  deleteByVideoSource
};
