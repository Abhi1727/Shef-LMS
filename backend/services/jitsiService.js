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
    throw new Error('Jitsi room creation is disabled (Firebase integration removed).');
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
    throw new Error('Jitsi room lookup is disabled (Firebase integration removed).');
  }

  /**
   * Get room by name
   */
  async getRoomByName(roomName) {
    return null;
  }

  /**
   * Update room status
   */
  async updateRoomStatus(roomId, status, additionalData = {}) {
    throw new Error('Jitsi room status updates are disabled (Firebase integration removed).');
  }

  /**
   * Add participant to room
   */
  async addParticipant(roomName, participantData) {
    throw new Error('Jitsi participant tracking is disabled (Firebase integration removed).');
  }

  /**
   * Get active rooms for a batch
   */
  async getActiveBatchRooms(batchId) {
    throw new Error('Jitsi batch rooms lookup is disabled (Firebase integration removed).');
  }

  /**
   * End a room/class
   */
  async endRoom(roomId) {
    throw new Error('Jitsi room end is disabled (Firebase integration removed).');
  }

  /**
   * Delete a room
   */
  async deleteRoom(roomId) {
    throw new Error('Jitsi room deletion is disabled (Firebase integration removed).');
  }

  /**
   * List all rooms (for admin)
   */
  async listAllRooms(limit = 50) {
    throw new Error('Jitsi room listing is disabled (Firebase integration removed).');
  }
}

module.exports = new JitsiService();
