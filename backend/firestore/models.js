/**
 * Firestore-backed model registry (DEV USE_FIRESTORE=true).
 * Collection names match the Mongo→Firestore export.
 */
const { createFsModel } = require('./FsModel');

const registry = {
  User: createFsModel('User', 'users'),
  Batch: createFsModel('Batch', 'batches'),
  Classroom: createFsModel('Classroom', 'classrooms'),
  LiveClass: createFsModel('LiveClass', 'liveclasses'),
  ActivityLog: createFsModel('ActivityLog', 'activitylogs'),
  PasswordOtp: createFsModel('PasswordOtp', 'passwordotps'),
  Course: createFsModel('Course', 'courses'),
  Module: createFsModel('Module', 'modules'),
  Conversation: createFsModel('Conversation', 'conversations'),
  Certificate: createFsModel('Certificate', 'certificates'),
  BatchMaterial: createFsModel('BatchMaterial', 'batch_materials'),
  StudentShare: createFsModel('StudentShare', 'student_shares'),
  OneToOneBatch: createFsModel('OneToOneBatch', 'onetoonebatches'),
  OneToOne: createFsModel('OneToOne', 'onetoones'),
  Resource: createFsModel('Resource', 'resources'),
  ResourceCategory: createFsModel('ResourceCategory', 'resourcecategories'),
  Student: createFsModel('Student', 'users'), // students live in users
  StudentQuestion: createFsModel('StudentQuestion', 'studentquestions'),
  StudentNote: createFsModel('StudentNote', 'studentnotes'),
  StudentBookmark: createFsModel('StudentBookmark', 'studentbookmarks'),
  KnowledgeSource: createFsModel('KnowledgeSource', 'knowledgesources'),
  KnowledgeChunk: createFsModel('KnowledgeChunk', 'knowledgechunks'),
  Question: createFsModel('Question', 'questions'),
  Assessment: createFsModel('Assessment', 'assessments'),
  AssessmentAttempt: createFsModel('AssessmentAttempt', 'assessmentattempts'),
  GeneratedNotes: createFsModel('GeneratedNotes', 'generatednotes'),
  Counter: createFsModel('Counter', 'counters'),
  Project: createFsModel('Project', 'projects'),
  Job: createFsModel('Job', 'jobs'),
  Lesson: createFsModel('Lesson', 'lessons'),
  SentEmail: createFsModel('SentEmail', 'sentemails'),
  UserProgress: createFsModel('UserProgress', 'userProgress'),
  Content: createFsModel('Content', 'content')
};

module.exports = registry;
