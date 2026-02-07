const admin = require('firebase-admin');
const crypto = require('crypto');

class JitsiService {
  constructor() {
    this.jitsiDomain = process.env.JITSI_DOMAIN || 'meet.learnwithus.sbs';
    this.jitsiAppId = process.env.JITSI_APP_ID || 'shef-lms';
  }

  /**
   * Create a Jitsi room for a live class
   * @param {Object} classData - Class information
   * @returns {Object} Room details with join URL
   */
  async createRoom(classData) {
    try {
      const { courseId, batchId, topic, scheduledDate, scheduledTime, duration, instructor, description } = classData;
      
      // Generate unique room name
      const roomName = this.generateRoomName(courseId, batchId, topic);
      
      // Generate join URLs
      const moderatorUrl = this.generateJoinUrl(roomName, true);
      const participantUrl = this.generateJoinUrl(roomName, false);
      
      // Create room configuration matching liveClasses collection format
      const roomConfig = {
        title: topic,
        course: courseId,
        scheduledDate,
        scheduledTime,
        duration: `${duration || 60} mins`,
        instructor: instructor || 'Instructor',
        description: description || '',
        roomName,
        moderatorUrl,
        zoomLink: participantUrl, // Use zoomLink field for compatibility
        batchId,
        status: 'scheduled',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        participants: []
      };

      // Store in liveClasses collection (NOT jitsiRooms) so students can see it
      const roomRef = await admin.firestore().collection('liveClasses').add(roomConfig);
      
      return {
        success: true,
        roomId: roomRef.id,
        roomName,
        moderatorUrl,
        participantUrl,
        config: roomConfig
      };
    } catch (error) {
      console.error('Error creating Jitsi room:', error);
      throw new Error('Failed to create Jitsi room');
    }
  }

  /**
   * Generate unique room name
   */
  generateRoomName(courseId, batchId, topic) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5')
      .update(`${courseId}-${batchId}-${topic}-${timestamp}`)
      .digest('hex')
      .substring(0, 8);
    
    // Format: batch-{batchId}-{hash}
    return `batch-${batchId}-${hash}`;
  }

  /**
   * Generate join URL for room
   */
  generateJoinUrl(roomName, isModerator = false) {
    const baseUrl = `https://${this.jitsiDomain}/${roomName}`;
    
    // For meet.jit.si, use config overrides in URL hash
    // Note: Public Jitsi has limited config override support
    const configParams = {
      'config.prejoinPageEnabled': 'false',
      'config.requireDisplayName': 'false',
      'config.enableWelcomePage': 'false',
      'config.disableDeepLinking': 'true'
    };
    
    // Add user info to bypass some lobby issues
    const userParams = isModerator 
      ? { 'userInfo.displayName': 'Instructor', 'userInfo.role': 'moderator' }
      : { 'userInfo.displayName': 'Student' };
    
    const allParams = { ...configParams, ...userParams };
    const paramString = Object.entries(allParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    return `${baseUrl}#${paramString}`;
  }

  /**
   * Get room details by ID
   */
  async getRoom(roomId) {
    try {
      const roomDoc = await admin.firestore().collection('jitsiRooms').doc(roomId).get();
      
      if (!roomDoc.exists) {
        throw new Error('Room not found');
      }

      return {
        success: true,
        room: {
          id: roomDoc.id,
          ...roomDoc.data()
        }
      };
    } catch (error) {
      console.error('Error getting room:', error);
      throw new Error('Failed to get room details');
    }
  }

  /**
   * Get room by name
   */
  async getRoomByName(roomName) {
    try {
      const snapshot = await admin.firestore()
        .collection('jitsiRooms')
        .where('roomName', '==', roomName)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }

      const roomDoc = snapshot.docs[0];
      return {
        id: roomDoc.id,
        ...roomDoc.data()
      };
    } catch (error) {
      console.error('Error getting room by name:', error);
      return null;
    }
  }

  /**
   * Update room status
   */
  async updateRoomStatus(roomId, status, additionalData = {}) {
    try {
      await admin.firestore().collection('jitsiRooms').doc(roomId).update({
        status,
        ...additionalData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating room status:', error);
      throw new Error('Failed to update room status');
    }
  }

  /**
   * Add participant to room
   */
  async addParticipant(roomName, participantData) {
    try {
      const room = await this.getRoomByName(roomName);
      
      if (!room) {
        throw new Error('Room not found');
      }

      await admin.firestore().collection('jitsiRooms').doc(room.id).update({
        participants: admin.firestore.FieldValue.arrayUnion(participantData),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Error adding participant:', error);
      throw new Error('Failed to add participant');
    }
  }

  /**
   * Get active rooms for a batch
   */
  async getActiveBatchRooms(batchId) {
    try {
      const snapshot = await admin.firestore()
        .collection('jitsiRooms')
        .where('batchId', '==', batchId)
        .where('status', 'in', ['scheduled', 'active'])
        .orderBy('startTime', 'desc')
        .get();

      const rooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        success: true,
        rooms
      };
    } catch (error) {
      console.error('Error getting batch rooms:', error);
      throw new Error('Failed to get batch rooms');
    }
  }

  /**
   * End a room/class
   */
  async endRoom(roomId) {
    try {
      await this.updateRoomStatus(roomId, 'ended', {
        endTime: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Error ending room:', error);
      throw new Error('Failed to end room');
    }
  }

  /**
   * Delete a room
   */
  async deleteRoom(roomId) {
    try {
      await admin.firestore().collection('jitsiRooms').doc(roomId).delete();
      return { success: true };
    } catch (error) {
      console.error('Error deleting room:', error);
      throw new Error('Failed to delete room');
    }
  }

  /**
   * List all rooms (for admin)
   */
  async listAllRooms(limit = 50) {
    try {
      const snapshot = await admin.firestore()
        .collection('jitsiRooms')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const rooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        success: true,
        rooms,
        count: rooms.length
      };
    } catch (error) {
      console.error('Error listing rooms:', error);
      throw new Error('Failed to list rooms');
    }
  }
}

module.exports = new JitsiService();
