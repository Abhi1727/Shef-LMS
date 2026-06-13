const mongoose = require('mongoose');

const knowledgeSourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  fileName: { type: String },
  fileUrl: { type: String },
  fileSizeBytes: { type: Number },
  fileFormat: { type: String },
  status: { type: String, enum: ['processing', 'processed', 'failed'], default: 'processing' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const knowledgeChunkSchema = new mongoose.Schema({
  sourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeSource', required: true },
  text: { type: String, required: true },
  index: { type: Number },
  headings: [{ type: String }],
  keywords: [{ type: String }],
  pageNumber: { type: Number }
});

const questionSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: [
      'mcq', 'multiple-select', 'true-false', 'fill-blank', 
      'short-answer', 'long-answer', 'coding', 'image', 
      'diagram', 'matching', 'ordering', 'case-study', 'scenario'
    ] 
  },
  questionText: { type: String, required: true },
  options: [{ type: String }], // For MCQ, Multiple Select, Matching, Ordering
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true }, // String, Array, or Object depending on type
  explanation: { type: String },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'expert'], default: 'medium' },
  bloomLevel: { type: String, enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'], default: 'understand' },
  topic: { type: String },
  subtopic: { type: String },
  learningObjective: { type: String },
  estimatedTime: { type: Number }, // in minutes
  marks: { type: Number, default: 1 },
  tags: [{ type: String }],
  sourceDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeSource' },
  sourcePage: { type: Number },
  confidenceScore: { type: Number, default: 1.0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isAiGenerated: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const assessmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  duration: { type: Number, required: true }, // in minutes
  difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'mixed' },
  passingMarks: { type: Number, default: 40 },
  negativeMarking: { type: Boolean, default: false },
  shuffleQuestions: { type: Boolean, default: true },
  shuffleOptions: { type: Boolean, default: true },
  retakeAllowed: { type: Boolean, default: true },
  availabilityDate: { type: Date },
  expiryDate: { type: Date },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }, // Link to a batch/classroom
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const assessmentAttemptSchema = new mongoose.Schema({
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    studentAnswer: { type: mongoose.Schema.Types.Mixed },
    isCorrect: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 } // in seconds
  }],
  score: { type: Number, default: 0 },
  maxScore: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  timeTaken: { type: Number, default: 0 }, // in seconds
  status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
  strengths: [{ type: String }],
  weakAreas: [{ type: String }],
  learningSuggestions: [{ type: String }],
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

const generatedNotesSchema = new mongoose.Schema({
  sourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeSource', required: true },
  summaryText: { type: String },
  cheatSheetText: { type: String },
  flashcards: [{
    front: String,
    back: String
  }],
  mindMapData: { type: mongoose.Schema.Types.Mixed },
  revisionNotes: { type: String },
  projectIdeas: [{ type: String }],
  interviewQuestions: [{
    question: String,
    answer: String
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  KnowledgeSource: mongoose.model('KnowledgeSource', knowledgeSourceSchema),
  KnowledgeChunk: mongoose.model('KnowledgeChunk', knowledgeChunkSchema),
  Question: mongoose.model('Question', questionSchema),
  Assessment: mongoose.model('Assessment', assessmentSchema),
  AssessmentAttempt: mongoose.model('AssessmentAttempt', assessmentAttemptSchema),
  GeneratedNotes: mongoose.model('GeneratedNotes', generatedNotesSchema)
};
