const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const {
  canChatPair,
  getTeachersForStudent,
  getStudentsForTeacher
} = require('../utils/chatAccess');

router.use(auth);

function isTeacherRole(role) {
  return role === 'teacher' || role === 'instructor';
}

function isStudentRole(role) {
  return role === 'student';
}

function normalizeText(text) {
  return String(text || '').trim().slice(0, 2000);
}

function newMessageId() {
  return crypto.randomBytes(12).toString('hex');
}

function serializeMessage(m) {
  const id = m._id || m.id;
  return {
    id: id ? String(id) : `${String(m.senderId || '')}-${new Date(m.createdAt || 0).getTime()}`,
    senderId: String(m.senderId),
    senderRole: m.senderRole,
    text: m.text,
    batchId: m.batchId || '',
    createdAt: m.createdAt,
    readAt: m.readAt || null
  };
}

function filterConversationsForBatch(convos, role, batchId, peers) {
  if (!batchId) return convos;
  const peerIds = new Set((peers || []).map((p) => String(p.id)));
  return convos.filter((c) => {
    const peerId = isStudentRole(role) ? c.teacherId : c.studentId;
    if (peerIds.has(String(peerId))) return true;
    return String(c.batchId || '') === String(batchId);
  });
}

function lastPreview(messages) {
  if (!messages?.length) return '';
  const last = messages[messages.length - 1];
  const t = String(last.text || '');
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

// @route   GET /api/chat/peers?batchId=
router.get('/peers', async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role = req.user.role;
    const batchId = String(req.query.batchId || '');

    if (isStudentRole(role)) {
      const peers = await getTeachersForStudent(userId, batchId);
      return res.json({ success: true, peers });
    }
    if (isTeacherRole(role)) {
      const peers = await getStudentsForTeacher(userId, batchId);
      return res.json({ success: true, peers });
    }
    return res.status(403).json({ success: false, message: 'Chat not available for this role' });
  } catch (error) {
    console.error('chat/peers error:', error);
    res.status(500).json({ success: false, message: 'Failed to load peers' });
  }
});

// @route   GET /api/chat/conversations?batchId=
router.get('/conversations', async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role = req.user.role;
    const batchId = String(req.query.batchId || '');
    let query;
    if (isStudentRole(role)) query = { studentId: userId };
    else if (isTeacherRole(role)) query = { teacherId: userId };
    else return res.status(403).json({ success: false, message: 'Chat not available for this role' });

    let convos = await Conversation.find(query)
      .sort({ lastMessageAt: -1 })
      .lean()
      .exec();

    let peersForFilter = [];
    if (batchId) {
      if (isStudentRole(role)) peersForFilter = await getTeachersForStudent(userId, batchId);
      else peersForFilter = await getStudentsForTeacher(userId, batchId);
      convos = filterConversationsForBatch(convos, role, batchId, peersForFilter);
    }

    const peerIds = convos.map((c) =>
      isStudentRole(role) ? c.teacherId : c.studentId
    );
    // Availability is for admins only — never return it to students.
    const peers = await User.find({ _id: { $in: peerIds.filter(Boolean) } })
      .select(isStudentRole(role) ? 'name role' : 'name isAvailable availabilityUpdatedAt role')
      .lean()
      .exec();
    const peerMap = new Map(peers.map((p) => [String(p._id), p]));

    const list = convos.map((c) => {
      const peerId = isStudentRole(role) ? c.teacherId : c.studentId;
      const peer = peerMap.get(String(peerId)) || {};
      const peerMeta = peersForFilter.find((p) => String(p.id) === String(peerId));
      const row = {
        id: String(c._id),
        peerId: String(peerId),
        peerName: peer.name || peerMeta?.name || 'User',
        peerRole: isStudentRole(role) ? 'teacher' : 'student',
        batchId: peerMeta?.batchId || c.batchId || '',
        batchName: peerMeta?.batchName || '',
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: lastPreview(c.messages),
        unread: isStudentRole(role) ? c.studentUnread || 0 : c.teacherUnread || 0
      };
      if (!isStudentRole(role)) {
        row.isAvailable = Boolean(peer.isAvailable);
        row.availabilityUpdatedAt = peer.availabilityUpdatedAt || null;
      }
      return row;
    });

    res.json({ success: true, conversations: list });
  } catch (error) {
    console.error('chat/conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to load conversations' });
  }
});

// @route   GET /api/chat/conversations/:id/messages
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role = req.user.role;
    const convo = await Conversation.findById(req.params.id).exec();
    if (!convo) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const isParticipant =
      (isStudentRole(role) && convo.studentId === userId) ||
      (isTeacherRole(role) && convo.teacherId === userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const since = req.query.since ? new Date(req.query.since) : null;
    let messages = convo.messages || [];
    if (since && !Number.isNaN(since.getTime())) {
      messages = messages.filter((m) => new Date(m.createdAt) > since);
    }

    // Mark unread as read for this caller
    let changed = false;
    const now = new Date();
    if (isStudentRole(role) && convo.studentUnread > 0) {
      convo.messages.forEach((m) => {
        if (String(m.senderId) !== userId && !m.readAt) {
          m.readAt = now;
          changed = true;
        }
      });
      convo.studentUnread = 0;
      changed = true;
    }
    if (isTeacherRole(role) && convo.teacherUnread > 0) {
      convo.messages.forEach((m) => {
        if (String(m.senderId) !== userId && !m.readAt) {
          m.readAt = now;
          changed = true;
        }
      });
      convo.teacherUnread = 0;
      changed = true;
    }
    if (changed) {
      convo.updatedAt = now;
      await convo.save();
    }

    res.json({
      success: true,
      conversationId: String(convo._id),
      messages: messages.map(serializeMessage)
    });
  } catch (error) {
    console.error('chat/messages get error:', error);
    res.status(500).json({ success: false, message: 'Failed to load messages' });
  }
});

// @route   POST /api/chat/messages
// body: { peerId, text, batchId? }
router.post('/messages', async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role = req.user.role;
    const peerId = String(req.body?.peerId || '');
    const batchId = String(req.body?.batchId || '');
    const text = normalizeText(req.body?.text);

    if (!peerId || !text) {
      return res.status(400).json({ success: false, message: 'peerId and text are required' });
    }

    let studentId;
    let teacherId;
    if (isStudentRole(role)) {
      studentId = userId;
      teacherId = peerId;
    } else if (isTeacherRole(role)) {
      teacherId = userId;
      studentId = peerId;
    } else {
      return res.status(403).json({ success: false, message: 'Chat not available for this role' });
    }

    const access = await canChatPair(studentId, teacherId, batchId);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: 'You can only chat with your assigned student or trainer'
      });
    }

    let convo = await Conversation.findOne({ studentId, teacherId }).exec();
    if (!convo) {
      convo = new Conversation({
        studentId,
        teacherId,
        batchId: access.batchId || batchId || '',
        messages: [],
        studentUnread: 0,
        teacherUnread: 0
      });
    } else if (access.batchId && (!convo.batchId || (batchId && convo.batchId !== access.batchId))) {
      convo.batchId = access.batchId;
    }

    const msg = {
      _id: newMessageId(),
      senderId: userId,
      senderRole: isStudentRole(role) ? 'student' : 'teacher',
      text,
      batchId: access.batchId || batchId || convo.batchId || '',
      createdAt: new Date(),
      readAt: null
    };
    convo.messages.push(msg);
    convo.lastMessageAt = msg.createdAt;
    convo.updatedAt = msg.createdAt;
    if (isStudentRole(role)) convo.teacherUnread = (convo.teacherUnread || 0) + 1;
    else convo.studentUnread = (convo.studentUnread || 0) + 1;

    await convo.save();
    const saved = convo.messages[convo.messages.length - 1];

    res.status(201).json({
      success: true,
      conversationId: String(convo._id),
      message: serializeMessage(saved)
    });
  } catch (error) {
    console.error('chat/messages post error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

module.exports = router;
