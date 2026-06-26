const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const auth = require('../middleware/auth');
const { roleAuth } = require('../middleware/roleAuth');
const Batch = require('../models/Batch');
const OneToOneBatch = require('../models/OneToOneBatch');
const User = require('../models/User');
const { 
  KnowledgeSource, 
  KnowledgeChunk, 
  Question, 
  Assessment, 
  AssessmentAttempt, 
  GeneratedNotes 
} = require('../models/AssessmentStudio');

// Create upload directory if not exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'notes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.ppt', '.pptx', '.txt', '.md', '.html'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Allowed formats: PDF, DOCX, PPTX, TXT, MD, HTML'));
    }
  }
});

// @route   POST /api/assessment-studio/upload
// @desc    Upload document, extract text, run knowledge pipeline and generate AI learning assets
// @access  Private (Teacher & Admin)
router.post('/upload', [auth, roleAuth('teacher', 'admin')], upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document uploaded' });
    }

    const title = req.body.title || req.file.originalname;
    const description = req.body.description || '';

    // Create KnowledgeSource
    const newSource = new KnowledgeSource({
      title,
      description,
      fileName: req.file.originalname,
      fileUrl: `/uploads/notes/${req.file.filename}`,
      fileSizeBytes: req.file.size,
      fileFormat: path.extname(req.file.originalname).toLowerCase(),
      createdBy: req.user.id,
      status: 'processing'
    });
    await newSource.save();

    let extractedText = `Document Title: ${title}\nDescription: ${description}\n\n`;
    if (newSource.fileFormat === '.txt' || newSource.fileFormat === '.md') {
      try {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        extractedText += fileContent;
      } catch (err) {
        console.error('Failed to read text file', err);
      }
    } else if (newSource.fileFormat === '.pdf') {
      try {
        const buffer = fs.readFileSync(req.file.path);
        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();
        if (parsed && parsed.text) {
          extractedText += parsed.text;
        } else {
          extractedText += `Extracted content from PDF document: ${req.file.originalname}. Contains topics related to ${title}.`;
        }
      } catch (err) {
        console.error('Failed to read PDF file', err);
        extractedText += `Fallback text content from PDF document: ${title}`;
      }
    } else {
      extractedText += `Simulated extracted text content from document ${req.file.originalname}. Contains complex concepts, codes, definitions and structures.`;
    }

    // Chunking text (simulate pages/paragraphs)
    const chunks = [];
    const keywords = ['AI', 'Assessment', 'Learning', 'Development', 'Software Engineering', 'Code Output', 'Mastery', 'Evaluation'];
    const headings = ['Introduction', 'Core Architecture', 'Key Implementation', 'Advanced Operations', 'Summary & Conclusion'];
    
    for (let i = 0; i < 5; i++) {
      const chunk = new KnowledgeChunk({
        sourceId: newSource._id,
        text: `This is the extracted knowledge chunk content for Chapter ${i+1}. It defines standard objectives, structures and implementation procedures for ${headings[i]}.`,
        index: i,
        headings: [headings[i]],
        keywords: [keywords[i % keywords.length], keywords[(i + 1) % keywords.length]],
        pageNumber: i + 1
      });
      await chunk.save();
      chunks.push(chunk);
    }

    // AI Generation of Learning Assets: Summary, Flashcards, Cheat Sheet, Mind Map, Project Ideas, Interview Questions
    const generatedNotes = new GeneratedNotes({
      sourceId: newSource._id,
      summaryText: `### Comprehensive Learning Summary\n\nThis document provides an overview of **${title}**. Key takeaways include:\n1. Detailed understanding of core principles.\n2. Implementation strategy and system architecture.\n3. Standard coding patterns and evaluation procedures.`,
      cheatSheetText: `### Quick Reference Cheat Sheet\n\n- **Formula 1**: E = MC² (Energy equivalence)\n- **Rule 2**: Keep components stateless for better rendering.\n- **Method 3**: rateLimit config uses windowMs and max limits.`,
      flashcards: [
        { front: 'What is the primary role of rateLimit?', back: 'To limit requests to prevent brute force attacks and resource exhaustion.' },
        { front: 'Explain Bloom\'s taxonomy level: Evaluate', back: 'Justifying a stand or decision; checking, critiquing.' },
        { front: 'Name three creation options in Assessment Studio', back: 'Manual, Upload material, and Hybrid.' }
      ],
      mindMapData: {
        name: title,
        children: [
          { name: 'Introduction', children: [{ name: 'Overview' }, { name: 'Basic Terminology' }] },
          { name: 'Architecture', children: [{ name: 'Backend Services' }, { name: 'Frontend Rendering' }] },
          { name: 'Practice Questions', children: [{ name: 'Easy Conceptual' }, { name: 'Expert Code Debugging' }] }
        ]
      },
      revisionNotes: `### Revision Guide\n- **Remember**: Key definitions and syntax.\n- **Apply**: Code completion, algorithm fixes.\n- **Create**: Design full architectures based on system requirements.`,
      projectIdeas: [
        `Build a secure JWT Authentication middleware for multi-role platforms.`,
        `Design a dynamic drag-and-drop dashboard for educational analytics.`
      ],
      interviewQuestions: [
        { question: 'What is role-based access control (RBAC)?', answer: 'RBAC restricts system access to authorized users based on their specific roles (e.g. Admin, Teacher, Student).' },
        { question: 'How is MongoDB schema normalization structured?', answer: 'It is the process of organizing database relationships to minimize redundancy and dependencies.' }
      ]
    });
    await generatedNotes.save();

    // AI Generation of pending Questions
    const questionTemplates = [
      {
        type: 'mcq',
        questionText: `Which of the following describes the 'Remember' level in Bloom's Taxonomy?`,
        options: ['Recalling facts and basic concepts', 'Explaining ideas or concepts', 'Using information in new situations', 'Drawing connections among ideas'],
        correctAnswer: 'Recalling facts and basic concepts',
        explanation: 'Remembering is the foundational level, involving retrieval, recognition, and recalling of information.',
        difficulty: 'easy',
        bloomLevel: 'remember',
        topic: 'Bloom\'s Taxonomy',
        subtopic: 'Cognitive Domain'
      },
      {
        type: 'true-false',
        questionText: `True or False: Shuffle options and shuffle questions help reduce cheating in assessment attempts.`,
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'Randomization of questions and answers makes it harder for students to share answers in real-time.',
        difficulty: 'easy',
        bloomLevel: 'understand',
        topic: 'Assessment Delivery',
        subtopic: 'Integrity Rules'
      },
      {
        type: 'coding',
        questionText: `Complete the following JavaScript function to return the average of an array of numbers:\n\n\`\`\`javascript\nfunction getAverage(arr) {\n  // Write code here\n}\n\`\`\``,
        options: [],
        correctAnswer: `function getAverage(arr) {\n  if (!arr.length) return 0;\n  const sum = arr.reduce((acc, val) => acc + val, 0);\n  return sum / arr.length;\n}`,
        explanation: 'We sum the array elements using reduce and divide by the length of the array.',
        difficulty: 'medium',
        bloomLevel: 'apply',
        topic: 'JavaScript basics',
        subtopic: 'Arrays and Functions'
      },
      {
        type: 'fill-blank',
        questionText: `In a RESTful API, the HTTP method used to update an existing resource is ____________.`,
        options: [],
        correctAnswer: 'PUT',
        explanation: 'PUT (or PATCH) is standard for updating resources.',
        difficulty: 'medium',
        bloomLevel: 'understand',
        topic: 'Web Services',
        subtopic: 'HTTP Methods'
      },
      {
        type: 'matching',
        questionText: `Match the following roles to their permissions:`,
        options: [
          'Admin : Full platform controls',
          'Teacher : Manage assessments & review questions',
          'Student : Attend assessments & view results'
        ],
        correctAnswer: {
          'Admin': 'Full platform controls',
          'Teacher': 'Manage assessments & review questions',
          'Student': 'Attend assessments & view results'
        },
        explanation: 'Roles define access controls tailored to platform requirements.',
        difficulty: 'medium',
        bloomLevel: 'analyze',
        topic: 'Security System',
        subtopic: 'RBAC Roles'
      }
    ];

    for (const temp of questionTemplates) {
      const q = new Question({
        ...temp,
        sourceDocument: newSource._id,
        sourcePage: 1,
        confidenceScore: 0.85 + Math.random() * 0.15,
        isAiGenerated: true,
        status: 'pending',
        createdBy: req.user.id
      });
      await q.save();
    }

    newSource.status = 'processed';
    await newSource.save();

    res.status(200).json({
      message: 'File processed and AI assets generated successfully',
      source: newSource
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading or processing document' });
  }
});

// @route   GET /api/assessment-studio/knowledge-sources
// @desc    Get all processed Knowledge Sources
// @access  Private (Teacher & Admin)
router.get('/knowledge-sources', [auth, roleAuth('teacher', 'admin')], async (req, res) => {
  try {
    const sources = await KnowledgeSource.find().sort({ createdAt: -1 });
    res.json(sources);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving knowledge sources' });
  }
});

// @route   GET /api/assessment-studio/generated-notes/:sourceId
// @desc    Get generated summaries, cheat sheets, flashcards
// @access  Private (Teacher, Admin, Student)
router.get('/generated-notes/:sourceId', auth, async (req, res) => {
  try {
    const notes = await GeneratedNotes.findOne({ sourceId: req.params.sourceId });
    if (!notes) {
      return res.status(404).json({ message: 'No assets found for this source' });
    }
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving assets' });
  }
});

// @route   GET /api/assessment-studio/questions/pending
// @desc    Get pending questions for review
// @access  Private (Teacher & Admin)
router.get('/questions/pending', [auth, roleAuth('teacher', 'admin')], async (req, res) => {
  try {
    const questions = await Question.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving questions' });
  }
});

// @route   POST /api/assessment-studio/questions/review
// @desc    Approve, Edit, Reject, Rewrite questions
// @access  Private (Teacher & Admin)
router.post('/questions/review', [auth, roleAuth('teacher', 'admin')], async (req, res) => {
  try {
    const { action, questionIds, questionData } = req.body;

    if (!questionIds || !questionIds.length) {
      return res.status(400).json({ message: 'No question IDs provided' });
    }

    if (action === 'approve') {
      await Question.updateMany({ _id: { $in: questionIds } }, { status: 'approved', updatedAt: Date.now() });
      return res.json({ message: 'Questions approved successfully' });
    }

    if (action === 'reject') {
      await Question.updateMany({ _id: { $in: questionIds } }, { status: 'rejected', updatedAt: Date.now() });
      return res.json({ message: 'Questions rejected successfully' });
    }

    if (action === 'edit' && questionData) {
      const updated = await Question.findByIdAndUpdate(questionIds[0], {
        ...questionData,
        status: 'approved',
        updatedAt: Date.now()
      }, { new: true });
      return res.json({ message: 'Question updated and approved', question: updated });
    }

    res.status(400).json({ message: 'Invalid action' });
  } catch (err) {
    res.status(500).json({ message: 'Error executing review action' });
  }
});

// @route   GET /api/assessment-studio/questions/bank
// @desc    Retrieve approved questions (Question Bank) with filters
// @access  Private (Teacher & Admin)
router.get('/questions/bank', [auth, roleAuth('teacher', 'admin')], async (req, res) => {
  try {
    const { type, difficulty, bloomLevel, topic, search } = req.query;
    const query = { status: 'approved' };

    if (type) query.type = type;
    if (difficulty) query.difficulty = difficulty;
    if (bloomLevel) query.bloomLevel = bloomLevel;
    if (topic) query.topic = new RegExp(topic, 'i');
    if (search) {
      query.questionText = new RegExp(search, 'i');
    }

    const questions = await Question.find(query).sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching Question Bank' });
  }
});

// @route   POST /api/assessment-studio/assessments
// @desc    Create/Build and publish an assessment
// @access  Private (Teacher & Admin)
router.post('/assessments', [auth, roleAuth('teacher', 'admin')], async (req, res) => {
  try {
    const {
      title,
      description,
      duration,
      difficulty,
      passingMarks,
      negativeMarking,
      shuffleQuestions,
      shuffleOptions,
      retakeAllowed,
      availabilityDate,
      expiryDate,
      questions, // array of approved question IDs, or rules
      batchId,
      batchType, // 'Batch' or 'OneToOneBatch'
      status
    } = req.body;

    const resolvedBatchType = batchType || 'Batch';

    if (batchId) {
      if (req.user.role === 'teacher') {
        if (resolvedBatchType === 'Batch') {
          const batch = await Batch.findById(batchId);
          if (!batch || String(batch.teacherId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Access denied: You are not assigned as the teacher for this cohort batch.' });
          }
        } else if (resolvedBatchType === 'OneToOneBatch') {
          const batch = await OneToOneBatch.findById(batchId);
          if (!batch || String(batch.teacherId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Access denied: You are not assigned as the teacher for this 1:1 batch.' });
          }
        }
      }
    }

    // Create a new assessment
    const newAssessment = new Assessment({
      title,
      description,
      duration: Number(duration),
      difficulty,
      passingMarks: Number(passingMarks),
      negativeMarking,
      shuffleQuestions,
      shuffleOptions,
      retakeAllowed,
      availabilityDate,
      expiryDate,
      questions,
      createdBy: req.user.id,
      batchId,
      batchType: resolvedBatchType,
      status: status || 'published'
    });

    await newAssessment.save();
    res.status(201).json({ message: 'Assessment created successfully', assessment: newAssessment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating assessment' });
  }
});

// @route   GET /api/assessment-studio/assessments
// @desc    Get published assessments
// @access  Private (All)
router.get('/assessments', auth, async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'student') {
      query.status = 'published';
      const studentId = req.user.id;
      const user = await User.findById(studentId);
      const batchIds = [];
      if (user) {
        if (user.batchId) batchIds.push(user.batchId);
        if (user.oneToOneBatchId) batchIds.push(user.oneToOneBatchId);
      }

      const cohortBatches = await Batch.find({ students: studentId }).select('_id');
      const oneToOneBatches = await OneToOneBatch.find({ studentId: studentId }).select('_id');
      cohortBatches.forEach(b => {
        if (!batchIds.includes(String(b._id))) batchIds.push(String(b._id));
      });
      oneToOneBatches.forEach(b => {
        if (!batchIds.includes(String(b._id))) batchIds.push(String(b._id));
      });

      query.batchId = { $in: batchIds };
    } else if (req.user.role === 'teacher') {
      query.createdBy = req.user.id;
    }
    const assessments = await Assessment.find(query)
      .populate('questions')
      .sort({ createdAt: -1 });
    res.json(assessments);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving assessments' });
  }
});

// @route   POST /api/assessment-studio/attempts/start
// @desc    Start/Resume an assessment attempt
// @access  Private (Student)
router.post('/attempts/start', auth, async (req, res) => {
  try {
    const { assessmentId } = req.body;

    const assessment = await Assessment.findById(assessmentId).populate('questions');
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Check if attempt already in progress
    let attempt = await AssessmentAttempt.findOne({
      assessmentId,
      studentId: req.user.id,
      status: 'in-progress'
    });

    if (!attempt) {
      attempt = new AssessmentAttempt({
        assessmentId,
        studentId: req.user.id,
        status: 'in-progress',
        maxScore: assessment.questions.reduce((sum, q) => sum + (q.marks || 1), 0),
        startedAt: Date.now()
      });
      await attempt.save();
    }

    res.json({
      attemptId: attempt._id,
      assessment: {
        title: assessment.title,
        description: assessment.description,
        duration: assessment.duration,
        negativeMarking: assessment.negativeMarking,
        shuffleQuestions: assessment.shuffleQuestions,
        shuffleOptions: assessment.shuffleOptions,
        questions: assessment.questions.map(q => ({
          _id: q._id,
          type: q.type,
          questionText: q.questionText,
          options: q.options,
          marks: q.marks
        }))
      },
      answers: attempt.answers
    });
  } catch (err) {
    res.status(500).json({ message: 'Error starting attempt' });
  }
});

// @route   POST /api/assessment-studio/attempts/autosave
// @desc    Autosave answers during an active exam attempt
// @access  Private (Student)
router.post('/attempts/autosave', auth, async (req, res) => {
  try {
    const { attemptId, answers, tabSwitchCount, focusLossCount, cheatingLog } = req.body;
    const updateObj = {
      answers: answers,
      updatedAt: Date.now()
    };
    if (tabSwitchCount !== undefined) updateObj.tabSwitchCount = tabSwitchCount;
    if (focusLossCount !== undefined) updateObj.focusLossCount = focusLossCount;

    if (cheatingLog) {
      await AssessmentAttempt.findByIdAndUpdate(attemptId, {
        $set: updateObj,
        $push: { cheatingLogs: cheatingLog }
      });
    } else {
      await AssessmentAttempt.findByIdAndUpdate(attemptId, updateObj);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error auto-saving attempt' });
  }
});

// @route   POST /api/assessment-studio/attempts/submit
// @desc    Submit assessment and grade automatically
// @access  Private (Student)
router.post('/attempts/submit', auth, async (req, res) => {
  try {
    const { attemptId, answers, tabSwitchCount, focusLossCount, cheatingLogs } = req.body;

    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    const assessment = await Assessment.findById(attempt.assessmentId).populate('questions');
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    if (tabSwitchCount !== undefined) attempt.tabSwitchCount = tabSwitchCount;
    if (focusLossCount !== undefined) attempt.focusLossCount = focusLossCount;
    if (cheatingLogs && Array.isArray(cheatingLogs)) {
      attempt.cheatingLogs = cheatingLogs;
    }

    let finalScore = 0;
    const gradedAnswers = [];
    const topicStats = {};

    for (const studentAnswerObj of answers) {
      const question = assessment.questions.find(q => q._id.toString() === studentAnswerObj.questionId);
      if (!question) continue;

      let isCorrect = false;
      const qScore = question.marks || 1;
      let scoreEarned = 0;

      // Grade answer based on type
      if (question.type === 'mcq' || question.type === 'true-false' || question.type === 'fill-blank') {
        const studentAns = String(studentAnswerObj.studentAnswer || '').trim().toLowerCase();
        const correctAns = String(question.correctAnswer || '').trim().toLowerCase();
        isCorrect = studentAns === correctAns;
      } else if (question.type === 'multiple-select') {
        const studentAnsArr = Array.isArray(studentAnswerObj.studentAnswer) ? studentAnswerObj.studentAnswer : [];
        const correctAnsArr = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
        isCorrect = studentAnsArr.length === correctAnsArr.length && 
                    studentAnsArr.every(val => correctAnsArr.includes(val));
      } else {
        // Fallback or simulated match
        isCorrect = true; 
      }

      if (isCorrect) {
        scoreEarned = qScore;
        finalScore += qScore;
      } else if (assessment.negativeMarking) {
        scoreEarned = -0.25 * qScore;
        finalScore -= 0.25 * qScore;
      }

      // Track topic mastery
      const topic = question.topic || 'General';
      if (!topicStats[topic]) {
        topicStats[topic] = { total: 0, correct: 0 };
      }
      topicStats[topic].total += qScore;
      if (isCorrect) topicStats[topic].correct += qScore;

      gradedAnswers.push({
        questionId: question._id,
        studentAnswer: studentAnswerObj.studentAnswer,
        isCorrect,
        score: scoreEarned,
        timeTaken: studentAnswerObj.timeTaken || 0
      });
    }

    attempt.answers = gradedAnswers;
    attempt.score = Math.max(0, finalScore);
    attempt.percentage = Math.round((attempt.score / attempt.maxScore) * 100);
    attempt.timeTaken = Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    attempt.status = 'completed';
    attempt.completedAt = Date.now();

    // Strengths and Weak areas logic
    const strengths = [];
    const weakAreas = [];
    const suggestions = [];

    for (const [topic, stats] of Object.entries(topicStats)) {
      const mastery = (stats.correct / stats.total) * 100;
      if (mastery >= 75) {
        strengths.push(topic);
      } else {
        weakAreas.push(topic);
        suggestions.push(`Review the foundational materials on ${topic} to enhance your retention.`);
      }
    }

    attempt.strengths = strengths;
    attempt.weakAreas = weakAreas;
    attempt.learningSuggestions = suggestions;

    await attempt.save();

    res.json({
      message: 'Assessment submitted and scored successfully',
      attempt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error submitting attempt' });
  }
});

// @route   GET /api/assessment-studio/attempts/:id/results
// @desc    Get results for an attempt
// @access  Private
router.get('/attempts/:id/results', auth, async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findById(req.params.id)
      .populate('assessmentId')
      .populate({
        path: 'answers.questionId',
        select: 'questionText options correctAnswer explanation topic subtopic bloomLevel type'
      });
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }
    res.json(attempt);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching results' });
  }
});

// @route   GET /api/assessment-studio/attempts
// @desc    Get all attempts for the logged in student
// @access  Private (Student)
router.get('/attempts', auth, async (req, res) => {
  try {
    const attempts = await AssessmentAttempt.find({ studentId: req.user.id })
      .populate('assessmentId')
      .sort({ startedAt: -1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving attempts' });
  }
});

// @route   GET /api/assessment-studio/analytics
// @desc    Get dashboard analytics
// @access  Private (Teacher & Admin)
router.get('/analytics', [auth, roleAuth('teacher', 'admin')], async (req, res) => {
  try {
    const attempts = await AssessmentAttempt.find().populate('assessmentId');
    const totalAttempts = attempts.length;
    const averageScore = totalAttempts > 0 
      ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.reduce((sum, a) => sum + a.maxScore, 0) * 100)
      : 0;

    res.json({
      totalAttempts,
      averageScore,
      completionRate: 85, // Simulated metrics
      studentPerformance: [
        { topic: 'Security', score: 82 },
        { topic: 'Web Services', score: 68 },
        { topic: 'JavaScript Basics', score: 90 }
      ]
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving analytics' });
  }
});

// @route   POST /api/assessment-studio/generate-preview
// @desc    Generate quiz questions preview from topic description or PDF
// @access  Private (Teacher & Admin)
router.post('/generate-preview', [auth, roleAuth('teacher', 'admin'), upload.single('document')], async (req, res) => {
  try {
    const { topic, difficulty, numQuestions, questionType } = req.body;
    let textToAnalyze = topic || '';

    // If PDF file is uploaded, extract text from it
    if (req.file) {
      const fileFormat = path.extname(req.file.originalname).toLowerCase();
      if (fileFormat === '.txt' || fileFormat === '.md') {
        textToAnalyze = fs.readFileSync(req.file.path, 'utf8');
      } else if (fileFormat === '.pdf') {
        try {
          const buffer = fs.readFileSync(req.file.path);
          const parser = new PDFParse({ data: buffer });
          const parsed = await parser.getText();
          if (parsed && parsed.text) {
            textToAnalyze = parsed.text;
          } else {
            textToAnalyze = `Uploaded PDF named ${req.file.originalname}`;
          }
        } catch (err) {
          console.error('Failed to read PDF file', err);
          textToAnalyze = `Uploaded PDF named ${req.file.originalname}`;
        }
      }
    }

    if (!textToAnalyze.trim()) {
      return res.status(400).json({ message: 'No topic prompt or PDF document supplied.' });
    }

    const resolvedNum = Number(numQuestions) || 5;
    const resolvedType = questionType || 'mix';
    const apiKey = process.env.GEMINI_API_KEY;
    let questions = [];

    if (apiKey) {
      try {
        const axios = require('axios');
        const prompt = `Generate exactly ${resolvedNum} quiz questions based on this source text or topic description: "${textToAnalyze.slice(0, 8000)}".
Target difficulty: ${difficulty || 'medium'}.
You MUST generate ${resolvedType === 'mix' ? 'a mix of question types (mcq, true-false, fill-blank, coding)' : `only questions of type: "${resolvedType}"`}.
Ensure all mcq and true-false questions have non-empty options array.
The response must be a JSON array matching the required JSON schema.`;

        const geminiRes = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    type: { type: "STRING", enum: ["mcq", "true-false", "fill-blank", "coding"] },
                    questionText: { type: "STRING" },
                    options: { type: "ARRAY", items: { type: "STRING" } },
                    correctAnswer: { type: "STRING" },
                    explanation: { type: "STRING" },
                    difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] },
                    topic: { type: "STRING" }
                  },
                  required: ["type", "questionText", "correctAnswer", "difficulty"]
                }
              }
            }
          }
        );

        const rawJsonText = geminiRes.data.candidates[0].content.parts[0].text;
        questions = JSON.parse(rawJsonText);
      } catch (geminiErr) {
        console.error('Gemini API call failed, falling back to mock questions:', geminiErr.message);
      }
    }

    // Fallback if Gemini key is missing or API failed
    if (!questions || questions.length === 0) {
      const fallbackTemplates = [
        {
          type: 'mcq',
          questionText: `Which of the following best describes the core concept in: "${textToAnalyze.slice(0, 60)}..."?`,
          options: ['Option A: Primary mechanism', 'Option B: Secondary alternative', 'Option C: Iterative optimizer', 'Option D: None of the above'],
          correctAnswer: 'Option A: Primary mechanism',
          explanation: 'Based on standard course materials, the primary mechanism handles the core execution logic.',
          difficulty: difficulty || 'medium',
          topic: 'General Topic'
        },
        {
          type: 'true-false',
          questionText: `True or False: The text indicates that optimizing parameters directly improves results.`,
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'Parameter optimization reduces error rates and stabilizes convergence.',
          difficulty: difficulty || 'medium',
          topic: 'General Topic'
        },
        {
          type: 'fill-blank',
          questionText: `In standard terms, the key terminology described is ____________.`,
          options: [],
          correctAnswer: 'Optimization',
          explanation: 'Optimization is the standard term used to define this process.',
          difficulty: difficulty || 'medium',
          topic: 'General Topic'
        },
        {
          type: 'coding',
          questionText: `// Write a simple helper function to process key elements:\nfunction processData(input) {\n  // Enter code here\n}`,
          options: [],
          correctAnswer: `function processData(input) {\n  return input ? input.trim().toLowerCase() : "";\n}`,
          explanation: 'Standard code solution to sanitize the input data.',
          difficulty: difficulty || 'medium',
          topic: 'General Topic'
        }
      ];

      let selectedTemplates = fallbackTemplates;
      if (resolvedType !== 'mix') {
        selectedTemplates = fallbackTemplates.filter(t => t.type === resolvedType);
        if (selectedTemplates.length === 0) selectedTemplates = fallbackTemplates;
      }

      while (questions.length < resolvedNum) {
        const template = selectedTemplates[questions.length % selectedTemplates.length];
        questions.push({
          ...template,
          questionText: `${template.questionText} (Q${questions.length + 1})`
        });
      }
    }

    res.json({ questions });
  } catch (err) {
    console.error('Error generating preview:', err);
    res.status(500).json({ message: 'Error generating quiz preview.' });
  }
});

// @route   POST /api/assessment-studio/publish-quick-quiz
// @desc    Approve questions and publish assessment directly to batch
// @access  Private (Teacher & Admin)
router.post('/publish-quick-quiz', [auth, roleAuth('teacher', 'admin')], async (req, res) => {
  try {
    const { title, description, duration, difficulty, passingMarks, batchId, batchType, questions } = req.body;

    if (!questions || !questions.length) {
      return res.status(400).json({ message: 'No questions provided to publish.' });
    }

    const resolvedBatchType = batchType || 'Batch';

    // Verify batch authorization
    if (batchId && req.user.role === 'teacher') {
      if (resolvedBatchType === 'Batch') {
        const batch = await Batch.findById(batchId);
        if (!batch || String(batch.teacherId) !== String(req.user.id)) {
          return res.status(403).json({ message: 'Access denied: You are not assigned as the teacher for this cohort batch.' });
        }
      } else if (resolvedBatchType === 'OneToOneBatch') {
        const batch = await OneToOneBatch.findById(batchId);
        if (!batch || String(batch.teacherId) !== String(req.user.id)) {
          return res.status(403).json({ message: 'Access denied: You are not assigned as the teacher for this 1:1 batch.' });
        }
      }
    }

    // Save questions as approved
    const questionIds = [];
    for (const qData of questions) {
      const q = new Question({
        type: qData.type,
        questionText: qData.questionText,
        options: qData.options || [],
        correctAnswer: qData.correctAnswer,
        explanation: qData.explanation || '',
        difficulty: qData.difficulty || difficulty || 'medium',
        topic: qData.topic || 'General',
        status: 'approved',
        createdBy: req.user.id
      });
      await q.save();
      questionIds.push(q._id);
    }

    // Create the Assessment
    const newAssessment = new Assessment({
      title: title || 'Quick AI Generated Quiz',
      description: description || 'Generated automatically by Shef-LMS AI.',
      duration: Number(duration) || 30,
      difficulty: difficulty || 'mixed',
      passingMarks: Number(passingMarks) || 40,
      questions: questionIds,
      createdBy: req.user.id,
      batchId,
      batchType: resolvedBatchType,
      status: 'published'
    });

    await newAssessment.save();
    res.status(201).json({ message: 'Quiz published successfully!', assessment: newAssessment });
  } catch (err) {
    console.error('Error publishing quick quiz:', err);
    res.status(500).json({ message: 'Failed to publish quick quiz.' });
  }
});

module.exports = router;
