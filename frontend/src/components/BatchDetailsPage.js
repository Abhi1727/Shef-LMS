import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ToastContainer, showToast } from './Toast';
import { YouTubeUtils } from '../utils/youtubeUtils';
import { formatDateForComponent } from '../utils/dateUtils';
import CustomVideoPlayer from './CustomVideoPlayer';
import ActivityTimelineChart from './charts/ActivityTimelineChart';
import { processActivityData, exportToCSV } from '../utils/activityDataProcessor';
import { getApiBaseUrl } from '../utils/apiBase';
import { downloadAuthenticatedFile } from '../utils/downloadFile';
import { sortLecturesNewestFirst } from '../utils/lectureSort';
import {
  applyTemplateToForm,
  BUILTIN_EMAIL_TEMPLATES,
  defaultEmailVariables,
  deleteEmailDraft,
  EMAIL_EDITABLE_FIELDS,
  getBuiltinTemplate,
  getIstTimeOptions,
  loadEmailDrafts,
  PLATFORM_OPTIONS,
  recalcUsTimings,
  resolveIstOptionId,
  saveEmailDraft,
  US_TIMING_KEYS
} from '../utils/emailTemplates';
import SkyLoadingScreen from './SkyLoadingScreen';
import './BatchDetailsPage.css';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseIstRangeToTimeInputs(range) {
  const defaultRange = { start: '', end: '' };
  if (!range || typeof range !== 'string') return defaultRange;

  const parts = range.split('-');
  if (parts.length !== 2) return defaultRange;

  const parsePart = (part) => {
    const match = part.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return '';
    let [, hourStr, minuteStr, ampm] = match;
    let hour = parseInt(hourStr, 10);
    const upper = ampm.toUpperCase();
    if (upper === 'PM' && hour !== 12) hour += 12;
    if (upper === 'AM' && hour === 12) hour = 0;
    const hourPadded = String(hour).padStart(2, '0');
    return `${hourPadded}:${minuteStr}`;
  };

  return {
    start: parsePart(parts[0]),
    end: parsePart(parts[1])
  };
}

function formatTimeRangeToIstString(start, end) {
  if (!start || !end) return '';

  const to12Hour = (time) => {
    const [hourStr, minuteStr] = time.split(':');
    let hour = parseInt(hourStr, 10);
    let period = 'AM';
    if (hour >= 12) {
      period = 'PM';
      if (hour > 12) hour -= 12;
    } else if (hour === 0) {
      hour = 12;
    }
    return `${hour}:${minuteStr} ${period}`;
  };

  const startStr = to12Hour(start);
  const endStr = to12Hour(end);
  return `${startStr} - ${endStr}`;
}

function formatLastLogin(student) {
  // Check for last login data in multiple possible locations
  const lastLoginTimestamp = student?.lastLogin?.timestamp || student?.lastLoginTimestamp;
  
  if (!lastLoginTimestamp) {
    return 'Never logged in';
  }
  
  const lastLoginDate = new Date(lastLoginTimestamp);
  const now = new Date();
  const diffMs = now - lastLoginDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // Format based on how recent the login was
  if (diffDays === 0) {
    // Today
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes === 0) {
        return 'Just now';
      }
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else {
    // For older logins, show the actual date
    return lastLoginDate.toLocaleDateString();
  }
}

// Enhanced file utility functions
const getFileIcon = (fileName) => {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  const iconMap = {
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'txt': '📃',
    'ppt': '📊',
    'pptx': '📊',
    'xls': '📈',
    'xlsx': '📈',
    'csv': '📋',
    'ipynb': '🧪',
    'zip': '🗜️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️'
  };
  return iconMap[extension] || '📎';
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const NOTES_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit (matches backend)

const validateFile = (file) => {
  if (!file) return 'No file selected';

  // Check file size (100MB limit)
  if (file.size > NOTES_MAX_FILE_SIZE) {
    return `File size (${formatFileSize(file.size)}) exceeds 100MB limit`;
  }

  const fileExtension = (file.name || '').toLowerCase().split('.').pop();
  const allowedExtensions = [
    'pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 
    'zip', 'rar', '7z', 'tar', 'gz', 'jpg', 'jpeg', 'png', 'gif', 'webp',
    'ipynb', 'py', 'json', 'sql', 'md', 'rtf'
  ];

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/x-python',
    'application/json',
    'application/x-ipynb+json',
    'application/vnd.rar',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    'text/markdown',
    'application/rtf',
    'application/sql'
  ];

  const isValidMimeType = !file.type || allowedTypes.includes(file.type) || file.type.startsWith('image/') || file.type.startsWith('text/');
  const isValidExtension = allowedExtensions.includes(fileExtension);

  if (!isValidExtension && !isValidMimeType) {
    return `File type .${fileExtension} is not supported. Allowed: ${allowedExtensions.slice(0, 10).join(', ')}, etc.`;
  }

  return null; // Valid
};

const BatchDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { batchId } = useParams();
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [classroomVideos, setClassroomVideos] = useState([]);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('videos');
  const [editingStudent, setEditingStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  
  // Enhanced student profile modal state
  const [activeProfileTab, setActiveProfileTab] = useState('profile');
  const [editMode, setEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [studentActivities, setStudentActivities] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState({
    action: '',
    startDate: '',
    endDate: ''
  });
  const [activityPagination, setActivityPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [activityTotal, setActivityTotal] = useState(0);
  const [reportPeriod, setReportPeriod] = useState('30');
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: ''
  });
  const [reportData, setReportData] = useState(null);
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  
  // Video modal confirmation dialog state
  const [showVideoConfirmDialog, setShowVideoConfirmDialog] = useState(false);
  const [hasUnsavedVideoChanges, setHasUnsavedVideoChanges] = useState(false);
  const [initialVideoFormData, setInitialVideoFormData] = useState({});
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ days: '', time: '' });
  const [timeRange, setTimeRange] = useState({ start: '', end: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSwitchTrainerModal, setShowSwitchTrainerModal] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [switchingTrainer, setSwitchingTrainer] = useState(false);
  const [addStudentsSearch, setAddStudentsSearch] = useState('');
  const [courses, setCourses] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    course: '',
    batchId: '',
    status: 'active'
  });
  const [videoFormData, setVideoFormData] = useState({
    title: '',
    youtubeVideoUrl: '',
    description: '',
    date: '',
    time: '',
    notesAvailable: false,
    notesFile: null
  });

  // Enhanced notes upload state
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileValidationError, setFileValidationError] = useState('');
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    email: '',
    batchId: '',
    course: '',
    status: 'active',
    phone: '',
    address: ''
  }); // 'videos' or 'students'
  
  const [allResources, setAllResources] = useState([]);
  const [batchResourcesEnabled, setBatchResourcesEnabled] = useState(false);
  
  // Email-related state
  const [emailForm, setEmailForm] = useState({
    subject: '',
    message: '',
    selectedStudents: []
  });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSearchTerm, setEmailSearchTerm] = useState('');
  const [emailQuickFilter, setEmailQuickFilter] = useState('all');
  const [emailDrafts, setEmailDrafts] = useState(() => loadEmailDrafts());
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState('zoom-lms-join');
  const [selectedEmailDraftId, setSelectedEmailDraftId] = useState('');
  const [draftNameInput, setDraftNameInput] = useState('');
  const [selectedIstTimeOptionId, setSelectedIstTimeOptionId] = useState('custom');
  const [emailVariables, setEmailVariables] = useState(() => defaultEmailVariables());

  // Activity graph state
  const [showLogins, setShowLogins] = useState(true);
  const [showVideoViews, setShowVideoViews] = useState(true);
  const [graphDateRange, setGraphDateRange] = useState({
    start: '',
    end: ''
  });

  // Helper function for normalizing IDs (moved here to be available for useMemo)
  const normId = (v) => (v != null && v !== '' ? String(v).trim() : '');
  const selectedBatchIdNorm = normId(selectedBatch?.id || selectedBatch?._id || batchId);

  useEffect(() => {
    if (activeView !== 'email') return;
    setEmailDrafts(loadEmailDrafts());
  }, [activeView]);

  useEffect(() => {
    if (activeView !== 'email' || !selectedBatch || selectedEmailDraftId) return;
    const vars = defaultEmailVariables(selectedBatch);
    setEmailVariables(vars);
    setSelectedIstTimeOptionId(resolveIstOptionId(vars.istTimeRange, selectedBatch));
  }, [activeView, selectedBatch?.id, selectedBatch?._id, selectedEmailDraftId]);

  useEffect(() => {
    if (activeView !== 'email' || !selectedBatch || selectedEmailDraftId) return;
    setEmailForm((prev) => {
      if (prev.message.trim()) return prev;
      const applied = applyTemplateToForm(
        selectedEmailTemplateId,
        defaultEmailVariables(selectedBatch)
      );
      return { ...prev, subject: applied.subject, message: applied.message };
    });
  }, [activeView, selectedBatch?.id, selectedBatch?._id, selectedEmailTemplateId, selectedEmailDraftId]);

  const refreshEmailDrafts = () => {
    const drafts = loadEmailDrafts();
    setEmailDrafts(drafts);
    return drafts;
  };

  const applyEmailFormFromTemplate = (templateId, variables) => {
    const applied = applyTemplateToForm(templateId, variables, {
      subject: emailForm.subject,
      message: emailForm.message
    });
    setEmailVariables(applied.variables);
    setEmailForm((prev) => ({
      ...prev,
      subject: applied.subject,
      message: applied.message
    }));
  };

  const handleEmailVariableChange = (key, value) => {
    setEmailVariables((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'istTimeRange') {
        const recalced = recalcUsTimings(next);
        setSelectedIstTimeOptionId(resolveIstOptionId(recalced.istTimeRange, selectedBatch));
        return recalced;
      }
      return next;
    });
  };

  const handleIstTimeOptionChange = (optionId) => {
    setSelectedIstTimeOptionId(optionId);
    if (optionId === 'custom') return;
    const option = getIstTimeOptions(selectedBatch).find((opt) => opt.id === optionId);
    if (!option?.istTimeRange) return;
    const vars = recalcUsTimings({ ...emailVariables, istTimeRange: option.istTimeRange });
    setEmailVariables(vars);
    applyEmailFormFromTemplate(selectedEmailTemplateId, vars);
  };

  const handleFillEmailFromBatch = () => {
    if (!selectedBatch) return;
    const vars = defaultEmailVariables(selectedBatch);
    setEmailVariables(vars);
    setSelectedIstTimeOptionId(resolveIstOptionId(vars.istTimeRange, selectedBatch));
    applyEmailFormFromTemplate(selectedEmailTemplateId, vars);
    showToast('Filled course, batch, schedule, and US timings from this batch.', 'success');
  };

  const handleLoadEmailTemplate = (templateId) => {
    setSelectedEmailTemplateId(templateId);
    setSelectedEmailDraftId('');
    setDraftNameInput('');
    const tpl = getBuiltinTemplate(templateId);
    if (!tpl) return;
    if (templateId === 'blank') {
      setEmailForm((prev) => ({ ...prev, subject: '', message: '' }));
      return;
    }
    const vars = recalcUsTimings(
      emailVariables.course || emailVariables.batchName
        ? emailVariables
        : defaultEmailVariables(selectedBatch)
    );
    applyEmailFormFromTemplate(templateId, vars);
  };

  const handleLoadEmailDraft = (draftId) => {
    const drafts = refreshEmailDrafts();
    if (!draftId) {
      setSelectedEmailDraftId('');
      setDraftNameInput('');
      return;
    }
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) {
      showToast('Draft not found. It may have been deleted in another tab.', 'warning');
      return;
    }
    setSelectedEmailDraftId(draftId);
    setDraftNameInput(draft.name || '');
    setSelectedEmailTemplateId(draft.templateId || 'class-announcement');
    const vars = recalcUsTimings({
      ...defaultEmailVariables(selectedBatch),
      ...(draft.variables || {})
    });
    setEmailVariables(vars);
    setSelectedIstTimeOptionId(
      draft.istTimeOptionId || resolveIstOptionId(vars.istTimeRange, selectedBatch)
    );
    const applied = applyTemplateToForm(draft.templateId || selectedEmailTemplateId, vars, {
      subject: draft.subject,
      message: draft.message
    });
    setEmailForm((prev) => ({
      ...prev,
      subject: applied.subject,
      message: applied.message
    }));
    showToast(`Loaded draft “${draft.name}”`, 'success');
  };

  const handleApplyEmailTemplate = () => {
    applyEmailFormFromTemplate(selectedEmailTemplateId, emailVariables);
    showToast('Template applied with current details.', 'success');
  };

  const handleNewEmailDraft = () => {
    setSelectedEmailDraftId('');
    setDraftNameInput('');
    const vars = defaultEmailVariables(selectedBatch);
    setEmailVariables(vars);
    setSelectedIstTimeOptionId(resolveIstOptionId(vars.istTimeRange, selectedBatch));
    applyEmailFormFromTemplate(selectedEmailTemplateId, vars);
  };

  const handleSaveEmailDraft = () => {
    const name = draftNameInput.trim();
    if (!name) {
      showToast('Enter a draft name in the box below, then save.', 'warning');
      return;
    }
    const tpl = getBuiltinTemplate(selectedEmailTemplateId);
    const vars = recalcUsTimings(emailVariables);
    const saved = saveEmailDraft({
      id: selectedEmailDraftId || undefined,
      name,
      templateId: selectedEmailTemplateId,
      subject: tpl && selectedEmailTemplateId !== 'blank' ? tpl.subject : emailForm.subject,
      message: tpl && selectedEmailTemplateId !== 'blank' ? tpl.message : emailForm.message,
      variables: vars,
      istTimeOptionId: selectedIstTimeOptionId
    });
    refreshEmailDrafts();
    setSelectedEmailDraftId(saved.id);
    setDraftNameInput(saved.name);
    showToast(selectedEmailDraftId ? 'Draft updated.' : 'Draft saved.', 'success');
  };

  const handleDeleteEmailDraft = (draftId = selectedEmailDraftId) => {
    if (!draftId) {
      showToast('Select a draft to delete.', 'warning');
      return;
    }
    const draft = emailDrafts.find((d) => d.id === draftId);
    if (!window.confirm(`Delete draft “${draft?.name || 'this draft'}”?`)) return;
    const remaining = deleteEmailDraft(draftId);
    setEmailDrafts(remaining);
    if (selectedEmailDraftId === draftId) {
      setSelectedEmailDraftId('');
      setDraftNameInput('');
    }
    showToast('Draft deleted.', 'success');
  };

  // Filter students for email section (moved here to avoid conditional hook usage)
  const filteredEmailStudents = useMemo(() => {
    try {
      // Return empty array if batchStudents is not yet available
      if (!students || !Array.isArray(students) || !selectedBatch) return [];
      
      let filtered = students.filter(student => {
        try {
          return student && normId(student.batchId) === selectedBatchIdNorm;
        } catch (e) {
          console.warn('Error filtering student:', e, student);
          return false;
        }
      });
      
      // Apply search filter
      if (emailSearchTerm && emailSearchTerm.trim()) {
        const term = emailSearchTerm.toLowerCase();
        filtered = filtered.filter(student => {
          try {
            return student && 
              (student.name && student.name.toLowerCase().includes(term)) ||
              (student.email && student.email.toLowerCase().includes(term));
          } catch (e) {
            console.warn('Error searching student:', e, student);
            return false;
          }
        });
      }
      
      // Apply quick filter
      if (emailQuickFilter === 'active') {
        filtered = filtered.filter(student => student && student.status === 'active');
      } else if (emailQuickFilter === 'inactive') {
        filtered = filtered.filter(student => student && student.status === 'inactive');
      }
      
      return filtered;
    } catch (e) {
      console.error('Error in filteredEmailStudents:', e);
      return [];
    }
  }, [students, selectedBatchIdNorm, emailSearchTerm, emailQuickFilter]);

  // Process activity data for graph
  const { chartData, summary: activitySummary } = useMemo(() => {
    return processActivityData(
      studentActivities,
      graphDateRange.start || activityFilter.startDate,
      graphDateRange.end || activityFilter.endDate
    );
  }, [studentActivities, graphDateRange, activityFilter]);

  // Filter students by batchId for consistency with Dashboard
  const batchStudents = students.filter(student => normId(student.batchId) === selectedBatchIdNorm);

  // Lock body scroll when any modal is open (prevents double scrollbar)
  useEffect(() => {
    const anyModalOpen = showAddStudentModal || showAddStudentsModal || showStudentModal ||
      showStudentDetailsModal || showScheduleModal || showAddVideoModal || showVideoConfirmDialog;
    if (anyModalOpen) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [showAddStudentModal, showAddStudentsModal, showStudentModal, showStudentDetailsModal, showScheduleModal, showAddVideoModal, showVideoConfirmDialog]);

  // Video modal change detection logic
  useEffect(() => {
    // Check if video form data has changed from initial state
    const hasChanges = JSON.stringify(videoFormData) !== JSON.stringify(initialVideoFormData);
    setHasUnsavedVideoChanges(hasChanges);
  }, [videoFormData, initialVideoFormData]);

  // Escape key handling for video modal
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && showAddVideoModal) {
        e.preventDefault();
        e.stopPropagation();
        handleVideoModalClose();
      }
    };

    if (showAddVideoModal) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showAddVideoModal, hasUnsavedVideoChanges]);

  // Determine if current user is an admin (from JWT)
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userFromToken = payload?.user;
      // For now admin == super admin; only admins should see timing controls
      if (userFromToken?.role === 'admin') {
        setIsAdmin(true);
      }
    } catch (e) {
      console.error('Error decoding admin token in BatchDetailsPage:', e);
    }
  }, []);

  const loadAvailableTeachers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return;
      const users = await response.json();
      const teachers = (Array.isArray(users) ? users : []).filter(u => u.role === 'teacher' && u.status !== 'inactive');
      setAvailableTeachers(teachers.map(t => ({
        id: String(t.id || t._id),
        name: t.name || 'Unnamed'
      })));
    } catch (err) {
      console.error('Failed to load teachers for switch trainer:', err);
    }
  }, []);

  const handleSwitchTrainer = async () => {
    if (!selectedBatch || !selectedTrainerId) {
      showToast('Please select a trainer', 'warning');
      return;
    }
    const trainer = availableTeachers.find(t => t.id === selectedTrainerId);
    if (!trainer) {
      showToast('Selected trainer not found', 'error');
      return;
    }
    setSwitchingTrainer(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const batchIdForApi = selectedBatch.id || selectedBatch._id;
      const response = await fetch(`${apiUrl}/api/admin/batches/${batchIdForApi}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: selectedBatch.name,
          course: selectedBatch.course,
          startDate: selectedBatch.startDate || null,
          endDate: selectedBatch.endDate || null,
          teacherId: trainer.id,
          teacherName: trainer.name,
          status: selectedBatch.status || 'active',
          batchType: selectedBatch.batchType || 'regular',
          programLabel: selectedBatch.programLabel || ''
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSelectedBatch(prev => ({
          ...prev,
          teacherId: trainer.id,
          teacherName: trainer.name
        }));
        setShowSwitchTrainerModal(false);
        showToast(`Trainer switched to ${trainer.name}`, 'success');
      } else {
        showToast(data.message || 'Failed to switch trainer', 'error');
      }
    } catch (err) {
      console.error('Switch trainer failed:', err);
      showToast('Failed to switch trainer', 'error');
    } finally {
      setSwitchingTrainer(false);
    }
  };

  // Load courses and batches data for add student form
  const loadCoursesAndBatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      // Load courses
      const coursesResponse = await fetch(`${apiUrl}/api/admin/courses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        setCourses(coursesData);
      }

      // Load all batches
      const batchesResponse = await fetch(`${apiUrl}/api/admin/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (batchesResponse.ok) {
        const batchesData = await batchesResponse.json();
        setAllBatches(batchesData.batches || []);
      }
    } catch (error) {
      console.error('Error loading courses and batches:', error);
    }
  };

  // Filter batches based on selected course
  const filterBatchesByCourse = (courseName) => {
    if (!courseName) {
      setAvailableBatches([]);
      return;
    }
    
    const filtered = allBatches.filter(batch => batch.course === courseName);
    setAvailableBatches(filtered);
    
    // Reset batch selection when course changes
    setNewStudentForm(prev => ({ ...prev, batchId: '' }));
  };

  // Handle course change in add student form
  const handleCourseChange = (courseName) => {
    setNewStudentForm(prev => ({ ...prev, course: courseName, batchId: '' }));
    filterBatchesByCourse(courseName);
  };

  // Load batch data
  const loadBatchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';
      let foundBatch = null;
      const normalizeId = (value) => (value != null ? String(value).trim() : '');
      const batchIdNorm = normalizeId(batchId);

      const [batchResponse, studentsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/batches/${encodeURIComponent(batchIdNorm)}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${apiUrl}/api/batches/${encodeURIComponent(batchIdNorm)}/students`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (batchResponse.ok) {
        const response = await batchResponse.json();
        const batch = response.batch || response;
        if (batch && (batch.id || batch._id)) {
          foundBatch = batch;
          setSelectedBatch(batch);
          setBatchResourcesEnabled(batch.resourcesEnabled || false);

          try {
            const resListResp = await fetch(`${apiUrl}/api/resources/admin/list`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (resListResp.ok) {
              const resList = await resListResp.json();
              setAllResources(resList);
            }
          } catch (e) {
            console.error('Error fetching admin resources list:', e);
          }

          if (batch.schedule) {
            const days = batch.schedule.days || '';
            const time = batch.schedule.time || '';
            setScheduleForm({ days, time });
            const parsedRange = parseIstRangeToTimeInputs(time);
            setTimeRange(parsedRange);
          }
        } else {
          showToast('Batch not found', 'error');
          return;
        }
      } else {
        showToast('Batch not found', 'error');
        return;
      }

      if (studentsResponse.ok) {
        const studentsPayload = await studentsResponse.json();
        const batchStudentList = studentsPayload.students || studentsPayload || [];
        setStudents(Array.isArray(batchStudentList) ? batchStudentList : []);
      }

      // Load classroom videos
      const batchIdForApi = foundBatch?.id || foundBatch?._id || batchId;
      const videosResponse = await fetch(`${apiUrl}/api/admin/classroom?batchId=${batchIdForApi}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (videosResponse.ok) {
        const batchVideos = await videosResponse.json();
        
        console.log('🔍 BatchDetails Debug - Videos for batch:', {
          batchId,
          batchName: foundBatch?.name,
          batchIdForApi,
          filteredVideos: batchVideos.length,
          sampleVideos: batchVideos.slice(0, 3).map(v => ({
            title: v.title,
            batchId: v.batchId,
            courseId: v.courseId
          }))
        });
        
        setClassroomVideos(batchVideos);
      }
    } catch (error) {
      console.error('Error loading batch data:', error);
      showToast('Error loading batch data', 'error');
    } finally {
      setLoading(false);
    }
  }, [batchId, navigate]);

  useEffect(() => {
    loadBatchData();
    loadCoursesAndBatches();
  }, [loadBatchData]);

  // Load full student list only when adding existing students (avoids scanning all users on page load)
  useEffect(() => {
    if (!showAddStudentsModal || allStudents.length) return;

    const loadAllStudentsForModal = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        const studentsResponse = await fetch(`${apiUrl}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (studentsResponse.ok) {
          const allUsers = await studentsResponse.json();
          setAllStudents(allUsers.filter((user) => user.role === 'student'));
        }
      } catch (err) {
        console.error('Error loading students for add modal:', err);
      }
    };

    loadAllStudentsForModal();
  }, [showAddStudentsModal, allStudents.length]);

  // Update new student form when batch changes
  useEffect(() => {
    if (selectedBatch) {
      setNewStudentForm(prev => ({
        ...prev,
        course: selectedBatch.course || '',
        batchId: selectedBatch.id || selectedBatch._id || ''
      }));
      // Filter batches for the current batch's course
      filterBatchesByCourse(selectedBatch.course);
    }
  }, [selectedBatch]);

  const handleBackToAdmin = () => {
    // Check if we have navigation state indicating where we came from
    const from = location.state?.from;
    
    if (from === 'admin-batches') {
      const section = location.state?.activeSection || 'batches';
      navigate('/admin', { state: { activeSection: section } });
    } else if (from === 'teacher-batches') {
      // Navigate back to teacher dashboard batches section
      navigate('/teacher', { state: { activeSection: 'batches' } });
    } else {
      // Fallback to admin dashboard or use browser history
      const userRole = localStorage.getItem('user') ? 
        JSON.parse(localStorage.getItem('user')).role : 'admin';
      
      if (userRole === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/admin');
      }
    }
  };

  const handleSaveSchedule = async () => {
    if (!selectedBatch) return;

    if (!scheduleForm.days.trim()) {
      showToast('Please select at least one day for this batch', 'warning');
      return;
    }

    if (!timeRange.start || !timeRange.end) {
      showToast('Please select both start and end time in IST', 'warning');
      return;
    }

    const timeString = formatTimeRangeToIstString(timeRange.start, timeRange.end);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;

      const body = {
        days: scheduleForm.days,
        time: timeString,
        timezone: 'IST'
      };

      const response = await fetch(`${apiUrl}/api/admin/batches/${batchIdForApi}/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Batch timing updated successfully!', 'success');
        setSelectedBatch(prev => {
          if (!prev) return prev;
          const newSchedule = data.schedule || { days: body.days, time: body.time, timezone: body.timezone };
          return { ...prev, schedule: newSchedule };
        });
        setScheduleForm({ days: body.days, time: body.time });
        setShowScheduleModal(false);
      } else {
        showToast(data.message || 'Failed to update batch timing', 'error');
      }
    } catch (error) {
      console.error('Error updating batch timing:', error);
      showToast('Error updating batch timing', 'error');
    }
  };

  const handleToggleResourcesEnabled = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;
      
      const newStatus = !batchResourcesEnabled;
      const response = await fetch(`${apiUrl}/api/admin/batches/${batchIdForApi}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resourcesEnabled: newStatus })
      });
      
      if (response.ok) {
        setBatchResourcesEnabled(newStatus);
        showToast(`Resources Center ${newStatus ? 'activated' : 'deactivated'} for this batch`, 'success');
      } else {
        showToast('Failed to update resource activation status', 'error');
      }
    } catch (err) {
      console.error('Error toggling resources:', err);
    }
  };

  const handleToggleResourceAssignment = async (resourceId, isAssigned) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;
      
      const method = isAssigned ? 'DELETE' : 'PUT';
      const response = await fetch(`${apiUrl}/api/resources/admin/batches/${batchIdForApi}/resources/${resourceId}`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isOneToOne: false })
      });
      
      if (response.ok) {
        // reload resources
        const resListResp = await fetch(`${apiUrl}/api/resources/admin/list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resListResp.ok) {
          const resList = await resListResp.json();
          setAllResources(resList);
        }
        showToast(isAssigned ? 'Resource removed from batch' : 'Resource assigned to batch', 'success');
      } else {
        showToast('Failed to update resource assignment', 'error');
      }
    } catch (err) {
      console.error('Error toggling resource assignment:', err);
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setStudentFormData({
      name: student.name,
      email: student.email,
      batchId: student.batchId || '',
      course: student.course || '',
      status: student.status || 'active',
      phone: student.phone || '',
      address: student.address || ''
    });
    setShowStudentModal(true);
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const handleViewStudentDetails = (student) => {
    setSelectedStudentDetails(student);
    setEditedProfile({
      name: student.name,
      email: student.email,
      phone: student.phone,
      address: student.address,
      status: student.status
    });
    setActiveProfileTab('profile');
    setEditMode(false);
    setShowStudentDetailsModal(true);
    
    // Load initial activity data
    loadStudentActivity(student.id);
  };

  // Load student activity data
  const loadStudentActivity = async (studentId, page = 1, filters = {}) => {
    setLoadingActivity(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: activityPagination.limit.toString(),
        ...filters
      });
      
      const response = await fetch(`${apiUrl}/api/admin/activity/${studentId}?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStudentActivities(data.activities || []);
        setActivityPagination(data.pagination || {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0
        });
        setActivityTotal(data.pagination?.total || 0);
      } else {
        console.error('Failed to load student activity');
        setStudentActivities([]);
      }
    } catch (error) {
      console.error('Error loading student activity:', error);
      setStudentActivities([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Handle activity filtering
  const handleFilterActivity = () => {
    loadStudentActivity(selectedStudentDetails.id, 1, activityFilter);
  };

  // Clear activity filters
  const handleClearActivityFilter = () => {
    const clearedFilter = { action: '', startDate: '', endDate: '' };
    setActivityFilter(clearedFilter);
    loadStudentActivity(selectedStudentDetails.id, 1, clearedFilter);
  };

  // Handle activity pagination
  const handleActivityPageChange = (newPage) => {
    loadStudentActivity(selectedStudentDetails.id, newPage, activityFilter);
  };

  // Handle profile editing
  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      const response = await fetch(`${apiUrl}/api/admin/users/${selectedStudentDetails.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editedProfile)
      });

      if (response.ok) {
        showToast('Student profile updated successfully!', 'success');
        
        // Update local state
        setSelectedStudentDetails(prev => ({ ...prev, ...editedProfile }));
        setStudents(prev => prev.map(student => 
          student.id === selectedStudentDetails.id 
            ? { ...student, ...editedProfile }
            : student
        ));
        
        setEditMode(false);
      } else {
        showToast('Failed to update student profile', 'error');
      }
    } catch (error) {
      console.error('Error updating student profile:', error);
      showToast('Error updating student profile', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditedProfile({
      name: selectedStudentDetails.name,
      email: selectedStudentDetails.email,
      phone: selectedStudentDetails.phone,
      address: selectedStudentDetails.address,
      status: selectedStudentDetails.status
    });
    setEditMode(false);
  };

  // Download activity CSV
  const handleDownloadActivityCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const queryParams = new URLSearchParams({
        export: 'csv',
        ...activityFilter
      });
      
      const response = await fetch(`${apiUrl}/api/admin/activity/${selectedStudentDetails.id}?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity-${selectedStudentDetails.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Activity data downloaded successfully!', 'success');
      } else {
        showToast('Failed to download activity data', 'error');
      }
    } catch (error) {
      console.error('Error downloading activity data:', error);
      showToast('Error downloading activity data', 'error');
    }
  };

  // Download graph data CSV
  const handleDownloadGraphCSV = () => {
    const { rawFilteredData } = processActivityData(
      studentActivities,
      graphDateRange.start || activityFilter.startDate,
      graphDateRange.end || activityFilter.endDate
    );
    
    const filename = `graph-activity-${selectedStudentDetails?.name?.replace(/\s+/g, '-') || 'student'}-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(rawFilteredData, filename);
    showToast('Graph data downloaded successfully!', 'success');
  };

  // Generate report
  const handleGenerateReport = async () => {
    try {
      let startDate, endDate;
      
      if (reportPeriod === 'custom') {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
      } else {
        const days = parseInt(reportPeriod);
        endDate = new Date().toISOString().split('T')[0];
        const start = new Date();
        start.setDate(start.getDate() - days);
        startDate = start.toISOString().split('T')[0];
      }

      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${apiUrl}/api/admin/activity/${selectedStudentDetails.id}?startDate=${startDate}&endDate=${endDate}&limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const activities = data.activities || [];
        
        // Generate report summary
        const summary = {
          totalActivities: activities.length,
          videoViews: activities.filter(a => a.action === 'video_view').length,
          assessments: activities.filter(a => a.action === 'assessment_submit').length,
          loginDays: new Set(activities.filter(a => a.action === 'login').map(a => a.timestamp?.split('T')[0])).size
        };
        
        setReportData(summary);
        showToast('Report generated successfully!', 'success');
      } else {
        showToast('Failed to generate report', 'error');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      showToast('Error generating report', 'error');
    }
  };

  // Download full student dossier PDF
  const handleDownloadReport = async (periodOverride = null) => {
    try {
      if (!selectedStudentDetails?.id && !selectedStudentDetails?._id) {
        showToast('No student selected', 'warning');
        return;
      }

      let startDate;
      let endDate;
      const period = periodOverride != null ? String(periodOverride) : reportPeriod;

      if (period === 'custom') {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
        if (!startDate || !endDate) {
          showToast('Select a custom date range first', 'warning');
          return;
        }
      } else {
        const days = parseInt(String(period).replace(/\D/g, ''), 10) || 30;
        endDate = new Date().toISOString().split('T')[0];
        const start = new Date();
        start.setDate(start.getDate() - days);
        startDate = start.toISOString().split('T')[0];
      }

      showToast('Generating PDF report…', 'info');
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const studentId = selectedStudentDetails.id || selectedStudentDetails._id;
      const params = new URLSearchParams({
        startDate,
        endDate,
        period: period === 'custom' ? 'custom' : String(period),
      });

      const response = await fetch(
        `${apiUrl}/api/admin/students/${studentId}/report.pdf?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        showToast(err.message || 'Failed to download PDF report', 'error');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sky-states-report-${String(selectedStudentDetails.name || 'student')
        .replace(/\s+/g, '-')
        .slice(0, 40)}-${startDate}-to-${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('PDF report downloaded', 'success');
    } catch (error) {
      console.error('Error downloading PDF report:', error);
      showToast('Error downloading PDF report', 'error');
    }
  };

  const handleAddNewStudent = async () => {
    try {
      const token = localStorage.getItem('token');
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';

      // Validate required fields
      if (!newStudentForm.name || !newStudentForm.email || !newStudentForm.password || !newStudentForm.course) {
        showToast('Please fill in all required fields (Name, Email, Password, Course)', 'warning');
        return;
      }

      const studentData = {
        name: newStudentForm.name,
        email: newStudentForm.email,
        password: newStudentForm.password,
        phone: newStudentForm.phone,
        address: newStudentForm.address,
        course: newStudentForm.course,
        batchId: newStudentForm.batchId,
        status: newStudentForm.status,
        role: 'student'
      };

      const response = await fetch(`${apiUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(studentData)
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Student added successfully!', 'success');
        
        // Add the new student to local state
        const newStudent = { id: data.id, ...studentData };
        setStudents(prev => [...prev, newStudent]);
        
        // Reset form and close modal
        setNewStudentForm({
          name: '',
          email: '',
          password: '',
          phone: '',
          address: '',
          course: '',
          batchId: '',
          status: 'active'
        });
        setAvailableBatches([]);
        setShowAddStudentModal(false);
      } else {
        showToast(data.message || 'Failed to add student', 'error');
      }
    } catch (error) {
      console.error('Error adding student:', error);
      showToast('Error adding student', 'error');
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSaveStudent = async () => {
    try {
      const token = localStorage.getItem('token');
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';

      const updateData = {
        name: studentFormData.name,
        email: studentFormData.email,
        batchId: studentFormData.batchId,
        course: studentFormData.course,
        status: studentFormData.status,
        phone: studentFormData.phone,
        address: studentFormData.address
      };

      const response = await fetch(`${apiUrl}/api/admin/users/${editingStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        showToast('Student updated successfully!', 'success');
        
        // Update student in local state
        setStudents(prev => prev.map(student => 
          student.id === editingStudent.id 
            ? { ...student, ...updateData }
            : student
        ));
        
        // Close modal
        setShowStudentModal(false);
        setEditingStudent(null);
      } else {
        showToast('Failed to update student', 'error');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      showToast('Error updating student', 'error');
    }
  };

  const handleAddStudentsToBatch = async () => {
    if (selectedStudentIds.length === 0) {
      showToast('Please select at least one student', 'warning');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;

      const response = await fetch(`${apiUrl}/api/batches/${batchIdForApi}/students`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentIds: selectedStudentIds })
      });

      if (response.ok) {
        showToast('Students added to batch successfully!', 'success');

        // Update local students state to reflect new batch assignment
        setStudents(prev =>
          prev.map(student =>
            selectedStudentIds.includes(student.id)
              ? { ...student, batchId: batchIdForApi }
              : student
          )
        );

        // Update selectedBatch to add students to batch's students array
        setSelectedBatch(prev => ({
          ...prev,
          students: [...new Set([...prev.students, ...selectedStudentIds])]
        }));

        // Refresh batch data to ensure consistency
        await refreshBatchData();

        setShowAddStudentsModal(false);
        setSelectedStudentIds([]);
      } else {
        showToast('Failed to add students to batch', 'error');
      }
    } catch (error) {
      console.error('Error adding students to batch:', error);
      showToast('Error adding students to batch', 'error');
    }
  };

  // Video modal confirmation dialog handlers
  const handleVideoModalClose = () => {
    if (hasUnsavedVideoChanges) {
      setShowVideoConfirmDialog(true);
    } else {
      closeVideoModal();
    }
  };

  const closeVideoModal = () => {
    setShowAddVideoModal(false);
    setEditingVideo(null);
    setVideoFormData({ title: '', youtubeVideoUrl: '', description: '', date: '', time: '', notesAvailable: false, notesFile: null });
    setInitialVideoFormData({});
    setHasUnsavedVideoChanges(false);
    setUploadedFileInfo(null);
    setFileValidationError('');
    setIsDragOver(false);
  };

  const handleVideoConfirmSave = async () => {
    // Save and close
    await handleAddVideoToBatch();
    setShowVideoConfirmDialog(false);
  };

  const handleVideoConfirmDiscard = () => {
    // Close without saving
    closeVideoModal();
    setShowVideoConfirmDialog(false);
  };

  const handleVideoConfirmCancel = () => {
    // Keep modal open
    setShowVideoConfirmDialog(false);
  };

  const handleAddVideoToBatch = async () => {
    // Declare timeoutId at function scope to be accessible in finally block
    let timeoutId;
    
    try {
      const { title, youtubeVideoUrl, driveUrl, driveId, description, date, notesAvailable, notesFile } = videoFormData;
      const isDrive = videoFormData.videoSource === 'drive' || (driveUrl && !youtubeVideoUrl);

      if (isDrive) {
        if (!title || (!driveUrl && !driveId) || !date) {
          showToast('Please fill in all required fields (Title, Google Drive Link, Class Date)', 'warning');
          return;
        }
      } else {
        if (!title || !youtubeVideoUrl || !date) {
          showToast('Please fill in all required fields (Title, YouTube URL, Class Date)', 'warning');
          return;
        }
      }

      if (notesAvailable && !notesFile) {
        showToast('Please select a notes file or uncheck "Notes Available"', 'warning');
        return;
      }

      let videoId = null;
      if (!isDrive) {
        videoId = YouTubeUtils.extractVideoId(youtubeVideoUrl);
        if (!videoId) {
          showToast('Invalid YouTube URL. Please use a valid YouTube video URL.', 'error');
          return;
        }

        // Prevent duplicate: same YouTube video already in this batch (client-side check)
        if (!editingVideo && selectedBatch) {
          const selId = (selectedBatch?.id || selectedBatch?._id || '').toString().trim();
          const alreadyInBatch = classroomVideos.some(
            v => (v.batchId || '').toString().trim() === selId &&
                 (v.youtubeVideoId || '') === videoId
          );
          if (alreadyInBatch) {
            showToast('This video is already in this batch. Each video can only be added once.', 'warning');
            return;
          }
        }
      }

      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;

      // Create FormData for file upload with enhanced error handling
      const formData = new FormData();
      formData.append('title', title);
      formData.append('instructor', 'Admin');
      formData.append('description', description || '');
      formData.append('courseId', selectedBatch?.course);
      formData.append('batchId', batchIdForApi);
      formData.append('type', 'Lecture');
      if (isDrive) {
        formData.append('videoSource', 'drive');
        formData.append('driveUrl', driveUrl || driveId);
        formData.append('driveId', driveId || driveUrl);
      } else {
        formData.append('videoSource', 'youtube-url');
        formData.append('youtubeVideoId', videoId);
        formData.append('youtubeVideoUrl', youtubeVideoUrl);
        formData.append('youtubeEmbedUrl', YouTubeUtils.getEmbedUrl(videoId));
      }
      formData.append('date', date);
      formData.append('time', videoFormData.time || '');
      formData.append('notesAvailable', notesAvailable);
      
      // Enhanced file handling with validation
      if (notesAvailable && notesFile) {
        // Double-check file validation before upload
        const validationError = validateFile(notesFile);
        if (validationError) {
          showToast(`File validation error: ${validationError}`, 'error');
          return;
        }
        
        console.log('Uploading file:', {
          name: notesFile.name,
          size: formatFileSize(notesFile.size),
          type: notesFile.type
        });
        
        formData.append('notesFile', notesFile);
        formData.append('notesFileName', notesFile.name);
      }

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      let response;
      let uploadError = null;
      
      try {
        if (editingVideo) {
          // Update existing video
          response = await fetch(`${apiUrl}/api/admin/classroom/${editingVideo.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData,
            signal: controller.signal
          });
        } else {
          // Create new video
          response = await fetch(`${apiUrl}/api/admin/classroom/youtube-url`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData,
            signal: controller.signal
          });
        }
      } catch (networkError) {
        console.error('Network error during upload:', networkError);
        uploadError = {
          type: 'network',
          message: 'Network connection failed. Please check your internet connection and try again.',
          details: networkError.message
        };
      }

      // Handle network errors
      if (uploadError) {
        showToast(uploadError.message, 'error');
        console.error('Upload failed:', uploadError.details);
        return;
      }

      // Parse response with enhanced error handling
      let data;
      try {
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          // Handle non-JSON responses (like HTML error pages)
          const text = await response.text();
          console.error('Non-JSON response received:', {
            status: response.status,
            statusText: response.statusText,
            contentType: contentType,
            responseText: text.substring(0, 500) // First 500 chars
          });
          
          // Try to extract error message from HTML response
          if (text.includes('File too large')) {
            showToast('File too large. Maximum size is 100MB.', 'error');
          } else if (text.includes('File type')) {
            showToast('File type not supported. Please check file format.', 'error');
          } else if (response.status === 413) {
            showToast('File too large. Maximum size is 100MB.', 'error');
          } else if (response.status === 415) {
            showToast('File type not supported. Please check file format.', 'error');
          } else {
            showToast('Server error occurred. Please try again.', 'error');
          }
          return;
        }
      } catch (parseError) {
        console.error('Response parsing error:', parseError);
        showToast('Server response error. Please try again.', 'error');
        return;
      }

      if (response.ok) {
        const successMessage = editingVideo ? 'Video updated successfully!' : 'YouTube video added successfully!';
        
        // Enhanced success message with file info
        if (notesAvailable && notesFile) {
          showToast(`${successMessage} Notes file "${notesFile.name}" uploaded.`, 'success');
        } else {
          showToast(successMessage, 'success');
        }

        if (editingVideo) {
          // Update existing video in the list
          setClassroomVideos(prev => prev.map(v => 
            v.id === editingVideo.id ? { ...data.lecture, id: editingVideo.id } : v
          ));
        } else {
          // Add new video to the list
          setClassroomVideos(prev => [{ id: data.lecture.id, ...data.lecture }, ...prev]);
        }

        // Reset form state
        setShowAddVideoModal(false);
        setEditingVideo(null);
        setVideoFormData({ title: '', youtubeVideoUrl: '', description: '', date: '', time: '', notesAvailable: false, notesFile: null });
        setUploadedFileInfo(null);
        setFileValidationError('');
        setIsDragOver(false);
      } else {
        // Enhanced error handling with specific messages
        let errorMessage = data.message || 'Failed to save YouTube video';
        
        if (response.status === 413) {
          errorMessage = 'File too large. Maximum size is 100MB.';
        } else if (response.status === 415) {
          errorMessage = 'Unsupported file type. Please check the file format.';
        } else if (response.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (response.status === 403) {
          errorMessage = 'Permission denied. You do not have access to perform this action.';
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        console.error('Upload error response:', {
          status: response.status,
          statusText: response.statusText,
          message: data.message,
          error: data.error
        });
        
        showToast('Error: ' + errorMessage, 'error');
      }
    } catch (error) {
      console.error('Unexpected error in handleAddVideoToBatch:', error);
      showToast('An unexpected error occurred. Please try again.', 'error');
    } finally {
      // Clean up timeout
      clearTimeout(timeoutId);
    }
  };

  const handleDownloadNotes = async (video) => {
    try {
      await downloadAuthenticatedFile(`/api/classroom/${video.id}/notes`, {
        filename: video.notesFileName || `notes-${video.title || 'untitled'}`
      });
      showToast(`Notes "${video.notesFileName || 'file'}" downloaded successfully!`, 'success');
    } catch (error) {
      console.error('Unexpected error in handleDownloadNotes:', error);
      showToast(
        error.message ||
          'Notes file is missing on the server. Ask your trainer to upload the notes file again — it will be saved to Google Drive.',
        'error'
      );
    }
  };

  // Enhanced file handling functions
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (file) => {
    // Clear previous error and uploaded file info
    setFileValidationError('');
    setUploadedFileInfo(null);
    
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setFileValidationError(validationError);
      // Reset file input
      const fileInput = document.getElementById('notesFileInput');
      if (fileInput) {
        fileInput.value = '';
      }
      return;
    }
    
    // Update state with selected file
    setVideoFormData(prev => ({ ...prev, notesFile: file }));
    setUploadedFileInfo({
      name: file.name,
      size: file.size,
      type: file.type || 'unknown',
      lastModified: file.lastModified
    });
    
    console.log('File selected successfully:', {
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    });
  };

  const removeUploadedFile = () => {
    setVideoFormData(prev => ({ ...prev, notesFile: null }));
    setUploadedFileInfo(null);
    setFileValidationError('');
    // Reset file input
    const fileInput = document.getElementById('notesFileInput');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleEditVideo = (video) => {
    setEditingVideo(video);
    
    // Populate the video form with existing video data for editing
    const formData = {
      title: video.title || '',
      youtubeVideoUrl: video.youtubeVideoUrl || '',
      driveUrl: video.driveId ? `https://drive.google.com/file/d/${video.driveId}/view` : '',
      driveId: video.driveId || '',
      videoSource: video.videoSource || (video.driveId && !video.youtubeVideoId ? 'drive' : 'youtube-url'),
      description: video.description || '',
      date: video.date || '',
      time: video.time || '',
      notesAvailable: video.notesAvailable || false,
      notesFile: null
    };
    
    setVideoFormData(formData);
    setInitialVideoFormData(formData);
    setHasUnsavedVideoChanges(false);
    
    // Open the add video modal with populated data
    setShowAddVideoModal(true);
  };

  const handleDeleteVideo = async (video) => {
    const selectedBatchId = selectedBatch?.id || selectedBatch?._id;
    if (!selectedBatchId) {
      showToast('Batch information not available', 'error');
      return;
    }

    if (window.confirm(`Remove "${video.title}" from this batch? This will not delete the video, only unassign it from this batch.`)) {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost'
          ? 'http://localhost:5000'
          : '';

        // Remove video from batch (disassociate, not delete)
        const response = await fetch(`${apiUrl}/api/batches/${selectedBatchId}/videos/${video.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          showToast('Video removed from batch successfully!', 'success');
          // Remove the video from the local state
          setClassroomVideos(prev => prev.filter(v => v.id !== video.id));
        } else {
          const errorData = await response.json();
          showToast('Error: ' + (errorData.message || 'Failed to remove video from batch'), 'error');
        }
      } catch (error) {
        console.error('Error removing video from batch:', error);
        showToast('Failed to remove video from batch. Please try again.', 'error');
      }
    }
  };

  // Refresh batch data to ensure consistency
  const refreshBatchData = async () => {
    try {
      const token = localStorage.getItem('token');
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';
      
      const response = await fetch(`${apiUrl}/api/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const batches = data.batches || [];
        const batch = batches.find(b => b.id === batchId || b._id === batchId);
        
        if (batch) {
          setSelectedBatch(batch);
        }
      }
    } catch (error) {
      console.error('Error refreshing batch data:', error);
    }
  };

  const handleDeleteStudent = async (student) => {
    const selectedBatchId = selectedBatch?.id || selectedBatch?._id;
    if (!selectedBatchId) {
      showToast('Batch information not available', 'error');
      return;
    }

    if (window.confirm(`Remove ${student.name} from this batch? This will not delete the student, only unassign them from this batch.`)) {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost'
          ? 'http://localhost:5000'
          : '';

        const response = await fetch(`${apiUrl}/api/batches/${selectedBatchId}/students/${student.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          showToast('Student removed from batch successfully!', 'success');
          
          // Update local state: clear batchId so they disappear from this batch view
          setStudents(prev => prev.map(s => 
            s.id === student.id ? { ...s, batchId: null } : s
          ));
          
          // Update selectedBatch to remove student from batch's students array
          setSelectedBatch(prev => ({
            ...prev,
            students: prev.students.filter(id => id !== student.id)
          }));
          
          // Refresh batch data to ensure consistency
          await refreshBatchData();
        } else {
          showToast('Failed to remove student from batch', 'error');
        }
      } catch (error) {
        console.error('Error removing student from batch:', error);
        showToast('Error removing student from batch', 'error');
      }
    }
  };

  // Quick select functions
  const handleQuickSelect = (filter) => {
    setEmailQuickFilter(filter);
  };

  const handleSelectAllFiltered = () => {
    const filteredEmails = filteredEmailStudents.map(student => student.email);
    setEmailForm(prev => ({
      ...prev,
      selectedStudents: filteredEmails
    }));
  };

  const handleSelectNone = () => {
    setEmailForm(prev => ({
      ...prev,
      selectedStudents: []
    }));
  };

  const handleSelectActive = () => {
    const activeEmails = batchStudents
      .filter(student => student.status === 'active')
      .map(student => student.email);
    setEmailForm(prev => ({
      ...prev,
      selectedStudents: activeEmails
    }));
  };

  const handleSendEmail = async () => {
    if (!emailForm.subject.trim() || !emailForm.message.trim() || emailForm.selectedStudents.length === 0) {
      showToast('Please fill in all required fields and select at least one student', 'warning');
      return;
    }

    setIsSendingEmail(true);
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;

      const response = await fetch(`${apiUrl}/api/admin/send-batch-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          batchId: batchIdForApi,
          subject: emailForm.subject,
          message: emailForm.message,
          studentEmails: emailForm.selectedStudents
        })
      });

      const data = await response.json();

      if (response.ok) {
        showToast(`Email sent successfully to ${emailForm.selectedStudents.length} student(s)!`, 'success');
        
        // Reset form and go back to videos view
        setEmailForm({ subject: '', message: '', selectedStudents: [] });
        setActiveView('videos');
      } else {
        showToast(data.message || 'Failed to send email', 'error');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showToast('Error sending email. Please try again.', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <SkyLoadingScreen
        message="Loading batch"
        subtext="Fetching videos, students, and schedule"
        compact
      />
    );
  }

  if (!selectedBatch) {
    return (
      <div className="teacher-batch-details-page">
        <div className="error">Batch not found</div>
      </div>
    );
  }

  // Filter videos for this batch (explicit batchId match only - no course fallback)
  const batchVideos = sortLecturesNewestFirst(
    classroomVideos.filter((video) => {
      if (!selectedBatchIdNorm) return false;
      return normId(video.batchId) === selectedBatchIdNorm;
    })
  );

  
  const hasValidBatch = (student) => {
    if (!student.batchId) return false;
    const val = String(student.batchId).trim();
    if (!val || val === 'null' || val === 'undefined') return false;
    return true;
  };

  // Students list for "Add Existing Students" modal: only show students with no batch yet
  const searchTerm = addStudentsSearch.trim().toLowerCase();
  const studentsForAddModal = allStudents.filter(student => {
    // Debug logging
    console.log('Filtering student:', {
      name: student.name,
      course: student.course,
      batchId: student.batchId,
      batchCourse: selectedBatch?.course,
      courseMatch: selectedBatch?.course && student.course === selectedBatch.course,
      hasNoBatch: !student.batchId
    });

    // Only show students whose course matches this batch's course (case-insensitive and flexible matching)
    if (selectedBatch?.course) {
      const batchCourseLower = selectedBatch.course.toLowerCase();
      const studentCourseLower = (student.course || '').toLowerCase();
      
      // Handle different course name variations
      const isCyberSecurityCourse = batchCourseLower.includes('cyber') || batchCourseLower.includes('security') || batchCourseLower.includes('cs&eh');
      const studentIsCyberSecurityCourse = studentCourseLower.includes('cyber') || studentCourseLower.includes('security') || studentCourseLower.includes('cs&eh');
      
      const isDataScienceCourse = batchCourseLower.includes('data') || batchCourseLower.includes('science') || batchCourseLower.includes('ai');
      const studentIsDataScienceCourse = studentCourseLower.includes('data') || studentCourseLower.includes('science') || studentCourseLower.includes('ai');
      
      if (!((isCyberSecurityCourse && studentIsCyberSecurityCourse) || 
            (isDataScienceCourse && studentIsDataScienceCourse) ||
            batchCourseLower === studentCourseLower)) {
        return false;
      }
    }

    // Only show students who don't have a batch assigned (batchId is null, undefined, or empty)
    if (student.batchId) {
      return false;
    }

    // Only show students who are not assigned to any batch yet
    if (hasValidBatch(student)) {
      return false;
    }

    if (!searchTerm) return true;
    const name = (student.name || '').toLowerCase();
    const email = (student.email || '').toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm);
  });

  console.log('Final filtered students for add modal:', studentsForAddModal.length);

  return (
    <>
    <div className="teacher-batch-details-page admin-batch-details-page sky-batch-page">
      
      {/* Sky States batch header */}
      <div className="sky-batch-header">
        <div className="sky-batch-header-main">
          <button onClick={handleBackToAdmin} className="sky-batch-back">
            ← Back
          </button>
          <div className="sky-batch-title-block">
            <h1 className="sky-batch-title">{selectedBatch.name}</h1>
            <div className="sky-batch-meta">
              <span className="sky-badge sky-badge-program">
                {selectedBatch.programLabel || selectedBatch.course}
              </span>
              {(selectedBatch.batchType === 'one-to-one' || (selectedBatch.course || '').toLowerCase().includes('one-to-one')) && (
                <span className="sky-badge sky-badge-type">One-to-One</span>
              )}
              {selectedBatch.batchType === 'project' && (
                <span className="sky-badge sky-badge-type">Project Class</span>
              )}
              <span className={`sky-badge sky-badge-status ${selectedBatch.status}`}>
                {selectedBatch.status}
              </span>
              <span className="sky-batch-trainer">
                Trainer: <strong>{selectedBatch.teacherName || 'Unassigned'}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="sky-batch-header-actions">
          {selectedBatch.schedule && (selectedBatch.schedule.days || selectedBatch.schedule.time) && (
            <div className="sky-batch-timing-chip">
              {(selectedBatch.schedule.days || '')}{(selectedBatch.schedule.days && selectedBatch.schedule.time) ? ' · ' : ''}
              {selectedBatch.schedule.time || ''}
              {selectedBatch.schedule.time ? ' IST' : ''}
            </div>
          )}
          {isAdmin && (
            <button
              type="button"
              className="sky-btn sky-btn-secondary"
              onClick={() => {
                setSelectedTrainerId(String(selectedBatch.teacherId || ''));
                loadAvailableTeachers();
                setShowSwitchTrainerModal(true);
              }}
            >
              Switch trainer
            </button>
          )}
        </div>
      </div>

      <div className="sky-batch-tabs">
        <button
          className={`sky-tab ${activeView === 'videos' ? 'active' : ''}`}
          onClick={() => handleViewChange('videos')}
        >
          Videos ({batchVideos.length})
        </button>
        <button
          className={`sky-tab ${activeView === 'students' ? 'active' : ''}`}
          onClick={() => handleViewChange('students')}
        >
          Students ({batchStudents.length})
        </button>
        <button
          className={`sky-tab ${activeView === 'timing' ? 'active' : ''}`}
          onClick={() => handleViewChange('timing')}
        >
          Timing
        </button>
        {isAdmin && (
          <button
            className={`sky-tab ${activeView === 'email' ? 'active' : ''}`}
            onClick={() => handleViewChange('email')}
          >
            Email
          </button>
        )}
        <button
          type="button"
          className={`sky-tab ${activeView === 'resources' ? 'active' : ''}`}
          onClick={() => handleViewChange('resources')}
        >
          Resources
        </button>
      </div>

      
      <div className="batch-content">
        {/* Main Content */}
        <div className="main-content">
          {activeView === 'timing' && (
            <div className="sky-timing-panel">
              <div className="sky-timing-card">
                <h2>Class schedule</h2>
                <p className="sky-muted">All times are entered in IST. Students see converted EST / CST / PST / MST.</p>
                {selectedBatch.schedule && (selectedBatch.schedule.days || selectedBatch.schedule.time) ? (
                  <div className="sky-timing-values">
                    <div><span className="sky-muted">Days</span><strong>{selectedBatch.schedule.days || '—'}</strong></div>
                    <div><span className="sky-muted">Time (IST)</span><strong>{selectedBatch.schedule.time || '—'}</strong></div>
                  </div>
                ) : (
                  <p className="sky-muted">No schedule set yet.</p>
                )}
                {isAdmin && (
                  <button
                    className="sky-btn sky-btn-primary"
                    onClick={() => {
                      const parsedRange = parseIstRangeToTimeInputs(scheduleForm.time || selectedBatch.schedule?.time || '');
                      setTimeRange(parsedRange);
                      setScheduleForm({
                        days: selectedBatch.schedule?.days || scheduleForm.days || '',
                        time: selectedBatch.schedule?.time || scheduleForm.time || ''
                      });
                      setShowScheduleModal(true);
                    }}
                  >
                    Edit timing
                  </button>
                )}
              </div>
            </div>
          )}
          {activeView === 'videos' && (
            <div className="videos-view">
              <div className="videos-header">
                <h2>Videos in {selectedBatch.name}</h2>
                <button
                  type="button"
                  className="sky-btn sky-btn-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingVideo(null);
                    const emptyFormData = {
                      title: '',
                      youtubeVideoUrl: '',
                      description: '',
                      date: '',
                      time: '',
                      notesAvailable: false,
                      notesFile: null,
                    };
                    setVideoFormData(emptyFormData);
                    setInitialVideoFormData(emptyFormData);
                    setHasUnsavedVideoChanges(false);
                    setUploadedFileInfo(null);
                    setFileValidationError('');
                    setIsDragOver(false);
                    setShowAddVideoModal(true);
                  }}
                >
                  Add Video
                </button>
              </div>
              {batchVideos.length > 0 ? (
                <div className="video-grid admin-video-grid">
                  {batchVideos.map((video) => {
                    const ytId =
                      video.youtubeVideoId ||
                      YouTubeUtils.extractVideoId(video.youtubeVideoUrl || video.videoUrl || '') ||
                      '';
                    const thumb = ytId
                        ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
                        : null;
                    const videoDate = formatDateForComponent(
                      video.classDate || video.date || video.createdAt
                    );
                    return (
                      <article key={video.id} className="video-card admin-video-card">
                        <button
                          type="button"
                          className="admin-video-thumb"
                          onClick={() => setSelectedVideo(video)}
                          aria-label={`Play ${video.title || 'lecture'}`}
                        >
                          {thumb ? (
                            <img src={thumb} alt="" loading="lazy" />
                          ) : (
                            <div className="admin-video-placeholder">
                              {video.zoomUrl ? 'Live' : 'Lecture'}
                            </div>
                          )}
                          {video.duration ? (
                            <span className="admin-video-duration">{video.duration}</span>
                          ) : null}
                        </button>
                        <div className="video-right admin-video-body">
                          <div className="video-info">
                            <h3 className="video-title admin-video-title" title={video.title}>
                              {video.title || 'Untitled lecture'}
                            </h3>
                            <div className="video-meta admin-video-meta">
                              <span>
                                Trainer: {selectedBatch.teacherName || video.instructor || '—'}
                              </span>
                              {videoDate ? <span>{videoDate}</span> : null}
                              {video.notesAvailable ? (
                                <span className="admin-notes-chip">Notes available</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="video-actions admin-video-actions">
                            <button
                              type="button"
                              className="sky-btn sky-btn-primary"
                              onClick={() => setSelectedVideo(video)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="sky-btn sky-btn-secondary"
                              disabled={!video.notesAvailable}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (video.notesAvailable) handleDownloadNotes(video);
                              }}
                              title={video.notesAvailable ? 'Download notes' : 'No notes attached'}
                            >
                              Notes
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  className="sky-btn sky-btn-secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditVideo(video);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="sky-btn sky-btn-secondary sky-btn-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      window.confirm(
                                        `Remove "${video.title}" from this batch? This will not delete the video, only unassign it from this batch.`
                                      )
                                    ) {
                                      handleDeleteVideo(video);
                                    }
                                  }}
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="no-data">
                  <p>📹 No videos found for this batch</p>
                  <small>Only videos explicitly assigned to this batch are shown (same as students see). Click "Add Video to Batch" to add lectures.</small>
                </div>
              )}
            </div>
          )}

          {activeView === 'students' && (
            <div className="students-view">
              <div className="students-header">
                <h2>👥 Students in {selectedBatch.name}</h2>
                <div className="students-actions">
                  <button
                    className="btn-add"
                    onClick={() => setShowAddStudentModal(true)}
                  >
                    ➕ Add Student
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowAddStudentsModal(true)}
                  >
                    👥 Add Existing Students
                  </button>
                </div>
              </div>

              {batchStudents.length > 0 ? (
                <div className="students-table-container">
                  <table className="students-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Last Login</th>
                        <th>Course</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchStudents.map(student => (
                        <tr 
                          key={student.id}
                          className="student-row"
                        >
                          <td>
                            <button 
                              onClick={() => handleViewStudentDetails(student)}
                              className="btn-link"
                              title="View Student Details"
                            >
                              {student.name}
                            </button>
                          </td>
                          <td>{student.email}</td>
                          <td>{formatLastLogin(student)}</td>
                          <td>{student.course}</td>
                          <td>
                            <span className={`status-badge ${student.status}`}>
                              {student.status}
                            </span>
                          </td>
                          <td>
                            <button 
                              onClick={() => handleEditStudent(student)}
                              className="btn-edit"
                              title="Edit Student"
                            >
                              ✏️ Edit
                            </button>
                            <button 
                              onClick={() => {
                                if (window.confirm(`Remove ${student.name} from this batch? This will not delete the student, only unassign them from this batch.`)) {
                                  // Handle student deletion
                                  handleDeleteStudent(student);
                                }
                              }}
                              className="btn-delete"
                              title="Remove from Batch"
                            >
                              🗑️ Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-data">
                  <p>👥 No students found in this batch</p>
                  <small>Students may be enrolled by batch ID or course matching</small>
                </div>
              )}
            </div>
          )}

          {activeView === 'resources' && (
            <div className="resources-view sky-resources">
              <div className="sky-resources-header">
                <div>
                  <h2>Resources</h2>
                  <p className="sky-muted">
                    Control student access and choose which handouts appear for {selectedBatch?.name || 'this batch'}.
                  </p>
                </div>
                <div className="sky-resources-controls">
                  <label className="sky-resources-field">
                    <span>Showcase universe</span>
                    <select
                      value={selectedBatch?.resourceUniverse || 'data-science-ai'}
                      onChange={async (e) => {
                        const newUniverse = e.target.value;
                        try {
                          const token = localStorage.getItem('token');
                          const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
                          const batchIdForApi = selectedBatch?.id || selectedBatch?._id;
                          const response = await fetch(`${apiUrl}/api/admin/batches/${batchIdForApi}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ resourceUniverse: newUniverse }),
                          });
                          if (response.ok) {
                            setSelectedBatch((prev) => ({ ...prev, resourceUniverse: newUniverse }));
                            showToast(
                              `Resources showcase set to ${
                                newUniverse === 'data-science-ai'
                                  ? 'Data Science'
                                  : newUniverse === 'cyber-security'
                                    ? 'Cyber Security'
                                    : 'Both'
                              }`,
                              'success'
                            );
                          } else {
                            showToast('Failed to update showcase universe', 'error');
                          }
                        } catch (err) {
                          console.error('Error updating resource universe:', err);
                        }
                      }}
                      className="sky-resources-select"
                    >
                      <option value="data-science-ai">Data Science & AI</option>
                      <option value="cyber-security">Cyber Security</option>
                      <option value="both">Both (Dual Universe)</option>
                    </select>
                  </label>
                  <div className="sky-resources-toggle-card">
                    <div>
                      <strong>Resources activated</strong>
                      <span>{batchResourcesEnabled ? 'Students can open Resources' : 'Hidden from students'}</span>
                    </div>
                    <label className="sky-switch">
                      <input
                        type="checkbox"
                        checked={batchResourcesEnabled}
                        onChange={handleToggleResourcesEnabled}
                      />
                      <span className="sky-switch__slider" />
                    </label>
                  </div>
                </div>
              </div>

              {!batchResourcesEnabled ? (
                <div className="sky-resources-empty">
                  <h3>Resources are disabled</h3>
                  <p>
                    Students in this batch cannot open the Resources center. Turn on the switch above to grant access,
                    then assign handouts below.
                  </p>
                </div>
              ) : (
                <div className="sky-resources-panel">
                  <div className="sky-resources-panel__head">
                    <h3>Handouts for this batch</h3>
                    <span className="sky-muted">
                      {allResources.filter((res) =>
                        (res.assignedBatches || []).some(
                          (id) => String(id) === String(selectedBatch?.id || selectedBatch?._id)
                        )
                      ).length}{' '}
                      assigned
                    </span>
                  </div>
                  <div className="sky-resources-table-wrap">
                    <table className="sky-resources-table">
                      <thead>
                        <tr>
                          <th>Resource</th>
                          <th>Type</th>
                          <th>Universe</th>
                          <th>Visible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allResources.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="sky-resources-table__empty">
                              No resources registered yet.
                            </td>
                          </tr>
                        ) : (
                          allResources.map((res, index) => {
                            const selectedIdStr = String(selectedBatch?.id || selectedBatch?._id);
                            const isAssigned = (res.assignedBatches || []).some(
                              (id) => String(id) === selectedIdStr
                            );
                            return (
                              <tr key={res._id || res.id || index} className={isAssigned ? 'is-assigned' : ''}>
                                <td>
                                  <strong>{res.title}</strong>
                                </td>
                                <td>
                                  <span className="sky-resources-type">{res.resourceType || '—'}</span>
                                </td>
                                <td className="sky-resources-universe">{res.course || '—'}</td>
                                <td>
                                  <label className="sky-resources-check">
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      onChange={() =>
                                        handleToggleResourceAssignment(res._id || res.id, isAssigned)
                                      }
                                    />
                                    <span>{isAssigned ? 'Shown' : 'Hidden'}</span>
                                  </label>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'email' && (
            <div className="email-view sky-email">
              <div className="sky-email-header">
                <div>
                  <h2>Email batch</h2>
                  <p className="sky-muted">
                    Message students in {selectedBatch?.name || 'this batch'} from admin@lms.skystates.us
                    (each student gets their own email)
                  </p>
                </div>
                <div className="sky-email-header-meta">
                  <span className="sky-email-count-chip">
                    {emailForm.selectedStudents.length} selected
                  </span>
                  <span className="sky-email-count-chip sky-email-count-chip--muted">
                    {batchStudents.length} in batch
                  </span>
                </div>
              </div>

              <div className="sky-email-layout">
                <aside className="sky-email-panel sky-email-recipients">
                  <div className="sky-email-panel__head">
                    <h3>Recipients</h3>
                    <div className="sky-email-recipient-actions">
                      <button type="button" className="sky-btn sky-btn-ghost sky-email-mini-btn" onClick={handleSelectAllFiltered}>
                        Select filtered
                      </button>
                      <button type="button" className="sky-btn sky-btn-ghost sky-email-mini-btn" onClick={handleSelectActive}>
                        Active only
                      </button>
                      <button type="button" className="sky-btn sky-btn-ghost sky-email-mini-btn" onClick={handleSelectNone}>
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="sky-email-toolbar">
                    <input
                      type="search"
                      placeholder="Search by name or email…"
                      value={emailSearchTerm}
                      onChange={(e) => setEmailSearchTerm(e.target.value)}
                      className="sky-email-search"
                    />
                    <div className="sky-email-filters" role="group" aria-label="Recipient filters">
                      <button
                        type="button"
                        className={`sky-email-filter ${emailQuickFilter === 'all' ? 'is-active' : ''}`}
                        onClick={() => handleQuickSelect('all')}
                      >
                        All ({batchStudents.length})
                      </button>
                      <button
                        type="button"
                        className={`sky-email-filter ${emailQuickFilter === 'active' ? 'is-active' : ''}`}
                        onClick={() => handleQuickSelect('active')}
                      >
                        Active ({batchStudents.filter((s) => s.status === 'active').length})
                      </button>
                      <button
                        type="button"
                        className={`sky-email-filter ${emailQuickFilter === 'inactive' ? 'is-active' : ''}`}
                        onClick={() => handleQuickSelect('inactive')}
                      >
                        Inactive ({batchStudents.filter((s) => s.status === 'inactive').length})
                      </button>
                    </div>
                  </div>

                  <label className="sky-email-select-all" htmlFor="select-all-students">
                    <input
                      type="checkbox"
                      id="select-all-students"
                      checked={
                        filteredEmailStudents.length > 0 &&
                        filteredEmailStudents.every((s) => emailForm.selectedStudents.includes(s.email))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEmailForm((prev) => ({
                            ...prev,
                            selectedStudents: filteredEmailStudents.map((student) => student.email),
                          }));
                        } else {
                          setEmailForm((prev) => ({ ...prev, selectedStudents: [] }));
                        }
                      }}
                    />
                    <span>
                      Select all shown ({filteredEmailStudents.length})
                    </span>
                  </label>

                  <div className="sky-email-students-list">
                    {filteredEmailStudents.length > 0 ? (
                      filteredEmailStudents.map((student) => {
                        const checked = emailForm.selectedStudents.includes(student.email);
                        const status = (student.status || 'active').toLowerCase();
                        return (
                          <label
                            key={student.id}
                            htmlFor={`email-student-${student.id}`}
                            className={`sky-email-student ${checked ? 'is-selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              id={`email-student-${student.id}`}
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEmailForm((prev) => ({
                                    ...prev,
                                    selectedStudents: [...prev.selectedStudents, student.email],
                                  }));
                                } else {
                                  setEmailForm((prev) => ({
                                    ...prev,
                                    selectedStudents: prev.selectedStudents.filter((email) => email !== student.email),
                                  }));
                                }
                              }}
                            />
                            <span className="sky-email-student__avatar" aria-hidden="true">
                              {(student.name || 'S').charAt(0).toUpperCase()}
                            </span>
                            <span className="sky-email-student__meta">
                              <span className="sky-email-student__name">{student.name}</span>
                              <span className="sky-email-student__email">{student.email}</span>
                            </span>
                            <span className={`sky-email-status sky-email-status--${status}`}>
                              {status}
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="sky-email-empty">
                        <p>
                          {emailSearchTerm || emailQuickFilter !== 'all'
                            ? 'No students match the current filters.'
                            : 'No students in this batch to email.'}
                        </p>
                      </div>
                    )}
                  </div>
                </aside>

                <section className="sky-email-panel sky-email-compose">
                  <div className="sky-email-panel__head">
                    <h3>Compose</h3>
                    <div className="sky-email-template-actions">
                      <button
                        type="button"
                        className="sky-btn sky-btn-ghost sky-email-mini-btn"
                        onClick={handleFillEmailFromBatch}
                      >
                        Fill from batch
                      </button>
                      <button
                        type="button"
                        className="sky-btn sky-btn-ghost sky-email-mini-btn"
                        onClick={handleApplyEmailTemplate}
                      >
                        Apply template
                      </button>
                    </div>
                  </div>

                  <div className="sky-email-templates">
                    <div className="sky-email-field">
                      <label htmlFor="sky-email-template">Template</label>
                      <select
                        id="sky-email-template"
                        className="sky-email-input"
                        value={selectedEmailTemplateId}
                        onChange={(e) => handleLoadEmailTemplate(e.target.value)}
                      >
                        {BUILTIN_EMAIL_TEMPLATES.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sky-email-drafts-panel">
                    <div className="sky-email-drafts-panel__head">
                      <h4>Saved drafts</h4>
                      <button
                        type="button"
                        className="sky-btn sky-btn-ghost sky-email-mini-btn"
                        onClick={handleNewEmailDraft}
                      >
                        New draft
                      </button>
                    </div>
                    <div className="sky-email-drafts-panel__save">
                      <input
                        type="text"
                        className="sky-email-input"
                        placeholder="Draft name (e.g. Weekend class announcement)"
                        value={draftNameInput}
                        onChange={(e) => setDraftNameInput(e.target.value)}
                        aria-label="Draft name"
                      />
                      <button
                        type="button"
                        className="sky-btn sky-btn-secondary"
                        onClick={handleSaveEmailDraft}
                      >
                        {selectedEmailDraftId ? 'Update draft' : 'Save draft'}
                      </button>
                    </div>
                    {emailDrafts.length === 0 ? (
                      <p className="sky-email-drafts-panel__empty">
                        No saved drafts yet. Fill details, name it, and click Save draft.
                      </p>
                    ) : (
                      <ul className="sky-email-drafts-list">
                        {emailDrafts.map((draft) => (
                          <li
                            key={draft.id}
                            className={`sky-email-drafts-item${
                              selectedEmailDraftId === draft.id ? ' is-active' : ''
                            }`}
                          >
                            <button
                              type="button"
                              className="sky-email-drafts-item__main"
                              onClick={() => handleLoadEmailDraft(draft.id)}
                            >
                              <strong>{draft.name}</strong>
                              <span>
                                {draft.savedAt
                                  ? new Date(draft.savedAt).toLocaleString('en-IN', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short'
                                    })
                                  : 'Saved'}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="sky-btn sky-btn-ghost sky-email-mini-btn"
                              onClick={() => handleDeleteEmailDraft(draft.id)}
                              aria-label={`Delete ${draft.name}`}
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="sky-email-variables">
                    <div className="sky-email-variables__head">
                      <h4>Details to insert</h4>
                      <p className="sky-muted">
                        Pick class time once — EST, CST, MST, and PST fill in automatically.
                      </p>
                    </div>
                    <div className="sky-email-variables__grid">
                      {EMAIL_EDITABLE_FIELDS.map(({ key, label, placeholder }) => (
                        <label key={key} className="sky-email-variables__field">
                          <span>{label}</span>
                          <input
                            type="text"
                            value={emailVariables[key] || ''}
                            onChange={(e) => handleEmailVariableChange(key, e.target.value)}
                            placeholder={placeholder || `{{${key}}}`}
                            className="sky-email-input"
                          />
                        </label>
                      ))}
                      <label className="sky-email-variables__field">
                        <span>Platform</span>
                        <select
                          className="sky-email-input"
                          value={emailVariables.platform || 'Zoom'}
                          onChange={(e) => handleEmailVariableChange('platform', e.target.value)}
                        >
                          {PLATFORM_OPTIONS.map((platform) => (
                            <option key={platform} value={platform}>
                              {platform}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="sky-email-variables__field sky-email-variables__field--wide">
                        <span>Class time (choose one)</span>
                        <select
                          className="sky-email-input"
                          value={selectedIstTimeOptionId}
                          onChange={(e) => handleIstTimeOptionChange(e.target.value)}
                        >
                          {getIstTimeOptions(selectedBatch).map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selectedIstTimeOptionId === 'custom' && (
                        <label className="sky-email-variables__field sky-email-variables__field--wide">
                          <span>Custom IST time</span>
                          <input
                            type="text"
                            value={emailVariables.istTimeRange || ''}
                            onChange={(e) => {
                              const vars = recalcUsTimings({
                                ...emailVariables,
                                istTimeRange: e.target.value
                              });
                              setEmailVariables(vars);
                              applyEmailFormFromTemplate(selectedEmailTemplateId, vars);
                            }}
                            placeholder="e.g. 6:00 AM - 8:00 AM"
                            className="sky-email-input"
                          />
                        </label>
                      )}
                    </div>
                    <div className="sky-email-us-timings">
                      <span className="sky-email-us-timings__label">US timings (auto)</span>
                      <div className="sky-email-us-timings__grid">
                        {US_TIMING_KEYS.map(({ key, label }) => (
                          <div key={key} className="sky-email-us-timings__item">
                            <strong>{label}</strong>
                            <span>{emailVariables[key] || '—'}</span>
                          </div>
                        ))}
                      </div>
                      <p className="sky-email-lms-link">
                        LMS login:{' '}
                        <a href={emailVariables.lmsUrl} target="_blank" rel="noopener noreferrer">
                          {emailVariables.lmsUrl}
                        </a>
                        <span className="sky-muted"> · Students receive a branded HTML email with an Open LMS button</span>
                      </p>
                    </div>
                  </div>

                  <div className="sky-email-from">
                    <span className="sky-email-from__label">From</span>
                    <span className="sky-email-from__value">admin@lms.skystates.us</span>
                  </div>

                  <div className="sky-email-field">
                    <label htmlFor="sky-email-subject">Subject</label>
                    <input
                      id="sky-email-subject"
                      type="text"
                      placeholder="e.g. Class update for this week"
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, subject: e.target.value }))}
                      className="sky-email-input"
                    />
                  </div>

                  <div className="sky-email-field sky-email-field--message">
                    <div className="sky-email-field__row">
                      <label htmlFor="sky-email-message">Message</label>
                      <span className="sky-email-char-count">
                        {emailForm.message.length}/5000
                      </span>
                    </div>
                    <textarea
                      id="sky-email-message"
                      placeholder="Write a clear message for the selected students…"
                      value={emailForm.message}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, message: e.target.value }))}
                      className="sky-email-textarea"
                      rows={12}
                      maxLength={5000}
                    />
                  </div>

                  <div className="sky-email-footer">
                    <p className="sky-email-footer__hint">
                      {emailForm.selectedStudents.length > 0
                        ? `Ready to send to ${emailForm.selectedStudents.length} student${emailForm.selectedStudents.length === 1 ? '' : 's'}.`
                        : 'Select at least one recipient to send.'}
                    </p>
                    <div className="sky-email-footer__actions">
                      <button
                        type="button"
                        className="sky-btn sky-btn-secondary"
                        onClick={() => {
                          setEmailForm({ subject: '', message: '', selectedStudents: [] });
                          setEmailSearchTerm('');
                          setEmailQuickFilter('all');
                          setSelectedEmailDraftId('');
                          setDraftNameInput('');
                          const vars = defaultEmailVariables(selectedBatch);
                          setEmailVariables(vars);
                          setSelectedIstTimeOptionId(resolveIstOptionId(vars.istTimeRange, selectedBatch));
                        }}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="sky-btn sky-btn-primary"
                        onClick={handleSendEmail}
                        disabled={
                          isSendingEmail ||
                          !emailForm.subject.trim() ||
                          !emailForm.message.trim() ||
                          emailForm.selectedStudents.length === 0
                        }
                      >
                        {isSendingEmail
                          ? 'Sending…'
                          : `Send email${emailForm.selectedStudents.length ? ` (${emailForm.selectedStudents.length})` : ''}`}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Student Edit Modal */}
      {showStudentModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowStudentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Student</h3>
              <button className="modal-close" onClick={() => setShowStudentModal(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <input
                type="text"
                placeholder="Student Name *"
                value={studentFormData.name}
                onChange={(e) => setStudentFormData({...studentFormData, name: e.target.value})}
                required
              />
              <input
                type="email"
                placeholder="Email Address *"
                value={studentFormData.email}
                onChange={(e) => setStudentFormData({...studentFormData, email: e.target.value})}
                required
              />
              <select
                value={studentFormData.batchId || ''}
                onChange={(e) => setStudentFormData({...studentFormData, batchId: e.target.value})}
              >
                <option value="">Select Batch</option>
                <option value={selectedBatch?.id || selectedBatch?._id}>
                  {selectedBatch?.name}
                </option>
              </select>
              <input
                type="text"
                placeholder="Course"
                value={studentFormData.course}
                onChange={(e) => setStudentFormData({...studentFormData, course: e.target.value})}
              />
              <select
                value={studentFormData.status || 'active'}
                onChange={(e) => setStudentFormData({...studentFormData, status: e.target.value})}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
              <input
                type="tel"
                placeholder="Phone Number"
                value={studentFormData.phone}
                onChange={(e) => setStudentFormData({...studentFormData, phone: e.target.value})}
              />
              <textarea
                placeholder="Address"
                value={studentFormData.address}
                onChange={(e) => setStudentFormData({...studentFormData, address: e.target.value})}
                rows="3"
              />
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setShowStudentModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleSaveStudent} className="btn-save">
                Save Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>

    {/* Video Player Modal */}
    {selectedVideo && (
      <CustomVideoPlayer
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
    )}

    {showAddVideoModal && selectedBatch && createPortal(
      <div className="batch-portal-modal-overlay" onClick={handleVideoModalClose} role="presentation">
        <div
          className="batch-portal-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-add-video-title"
        >
          <div className="batch-portal-modal-header">
            <h3 id="batch-add-video-title">
              {editingVideo ? 'Edit Video' : 'Add Video'} to {selectedBatch.name}
            </h3>
            <button
              type="button"
              className="batch-portal-modal-close"
              onClick={handleVideoModalClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="batch-portal-modal-content">
            <p className="batch-portal-modal-subtitle">
              Paste a YouTube video URL to add it for this batch only. Each video can only be added once per batch.
            </p>

            <input
              type="text"
              placeholder="Video Title *"
              value={videoFormData.title}
              onChange={(e) => setVideoFormData({ ...videoFormData, title: e.target.value })}
              required
            />
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setVideoFormData({ ...videoFormData, videoSource: 'youtube-url' })}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid ' + (videoFormData.videoSource !== 'drive' ? '#ff0000' : '#ddd'),
                  background: videoFormData.videoSource !== 'drive' ? '#fff5f5' : '#fff',
                  color: videoFormData.videoSource !== 'drive' ? '#c00' : '#555',
                  fontWeight: videoFormData.videoSource !== 'drive' ? '600' : 'normal',
                  cursor: 'pointer'
                }}
              >
                📺 YouTube URL
              </button>
              <button
                type="button"
                onClick={() => setVideoFormData({ ...videoFormData, videoSource: 'drive' })}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid ' + (videoFormData.videoSource === 'drive' ? '#0f9d58' : '#ddd'),
                  background: videoFormData.videoSource === 'drive' ? '#f0fdf4' : '#fff',
                  color: videoFormData.videoSource === 'drive' ? '#0b6623' : '#555',
                  fontWeight: videoFormData.videoSource === 'drive' ? '600' : 'normal',
                  cursor: 'pointer'
                }}
              >
                📁 Google Drive Link
              </button>
            </div>
            {videoFormData.videoSource === 'drive' ? (
              <input
                type="text"
                placeholder="Google Drive Link or File ID *"
                value={videoFormData.driveUrl || videoFormData.driveId || ''}
                onChange={(e) => setVideoFormData({ ...videoFormData, driveUrl: e.target.value, driveId: e.target.value })}
                required
              />
            ) : (
              <input
                type="text"
                placeholder="YouTube Video URL *"
                value={videoFormData.youtubeVideoUrl || ''}
                onChange={(e) => setVideoFormData({ ...videoFormData, youtubeVideoUrl: e.target.value })}
                required
              />
            )}
            <input
              type="date"
              placeholder="Class Date *"
              value={videoFormData.date}
              onChange={(e) => setVideoFormData({ ...videoFormData, date: e.target.value })}
              required
              style={{ marginBottom: '15px' }}
            />
            <input
              type="text"
              placeholder="Class Time (e.g., 7:00 PM)"
              value={videoFormData.time || ''}
              onChange={(e) => setVideoFormData({ ...videoFormData, time: e.target.value })}
              style={{ marginBottom: '15px' }}
              title="Optional: Use batch timing or enter custom time"
            />
            <small style={{color: '#888', fontSize: '12px', display: 'block', marginBottom: '15px'}}>
              * Required fields. Class time will be displayed with the video.
            </small>
            <textarea
              placeholder="Description (optional)"
              rows="3"
              value={videoFormData.description}
              onChange={(e) => setVideoFormData({ ...videoFormData, description: e.target.value })}
            />
            
            <div className="enhanced-notes-section">
              <div className="notes-header">
                <label className="enhanced-notes-label">
                  <input
                    type="checkbox"
                    checked={videoFormData.notesAvailable}
                    onChange={(e) => setVideoFormData({ ...videoFormData, notesAvailable: e.target.checked, notesFile: e.target.checked ? null : null })}
                    className="notes-checkbox"
                  />
                  <span className="checkbox-custom"></span>
                  <span className="notes-label-text">📄 Upload Notes for Students</span>
                </label>
              </div>
              
              {videoFormData.notesAvailable && (
                <div className="notes-upload-area">
                  <div 
                    className={`drag-drop-zone ${isDragOver ? 'drag-over' : ''} ${uploadedFileInfo ? 'has-file' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleFileDrop}
                    onClick={() => document.getElementById('notesFileInput').click()}
                  >
                    <div className="upload-content">
                      {uploadedFileInfo ? (
                        <div className="file-preview">
                          <div className="file-icon">{getFileIcon(uploadedFileInfo.name)}</div>
                          <div className="file-details">
                            <div className="file-name">{uploadedFileInfo.name}</div>
                            <div className="file-size">{formatFileSize(uploadedFileInfo.size)}</div>
                          </div>
                          <button 
                            className="remove-file-btn" 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeUploadedFile();
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="upload-prompt">
                          <div className="upload-icon">📁</div>
                          <div className="upload-text">
                            <p className="primary-text">Drag & drop your notes file here</p>
                            <p className="secondary-text">or click to browse</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <input
                    id="notesFileInput"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.csv,.ipynb,.zip,.rar,.7z,.tar,.gz,.py,.json,.sql,.md,.rtf,.jpg,.jpeg,.png,.gif,.webp"
                    onChange={handleFileSelect}
                    className="hidden-file-input"
                  />
                  
                  {fileValidationError && (
                    <div className="file-validation-error">
                      ⚠️ {fileValidationError}
                    </div>
                  )}
                  
                  <div className="supported-formats">
                    <span className="formats-label">Supported formats:</span>
                    <div className="format-badges">
                      <span className="format-badge">PDF</span>
                      <span className="format-badge">DOC</span>
                      <span className="format-badge">PPT</span>
                      <span className="format-badge">XLS</span>
                      <span className="format-badge">CSV</span>
                      <span className="format-badge">IPYNB</span>
                      <span className="format-badge">CODE</span>
                      <span className="format-badge">ZIP</span>
                      <span className="format-badge">IMG</span>
                    </div>
                  </div>
                  
                  <div className="upload-guidelines">
                    <p>📝 Maximum file size: 100MB</p>
                    <p>🔒 Files are securely stored and shared only with enrolled students</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="batch-portal-modal-actions">
            <button
              type="button"
              className="sky-btn sky-btn-secondary"
              onClick={handleVideoModalClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sky-btn sky-btn-primary"
              onClick={handleAddVideoToBatch}
            >
              Save Video
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Video Modal Confirmation Dialog */}
    {showVideoConfirmDialog && createPortal(
      <div className="batch-portal-modal-overlay" role="presentation">
        <div
          className="batch-portal-modal batch-portal-confirm"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="batch-portal-modal-header">
            <h3>Unsaved Changes</h3>
          </div>
          
          <div className="batch-portal-modal-content">
            <p>You have unsaved changes in the video form. What would you like to do?</p>
          </div>
          
          <div className="batch-portal-modal-actions confirm-actions">
            <button
              type="button"
              className="sky-btn sky-btn-primary"
              onClick={handleVideoConfirmSave}
            >
              Save & Close
            </button>
            <button
              type="button"
              className="sky-btn sky-btn-secondary"
              onClick={handleVideoConfirmDiscard}
            >
              Close without Saving
            </button>
            <button
              type="button"
              className="sky-btn sky-btn-ghost"
              onClick={handleVideoConfirmCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {showScheduleModal && createPortal(
      <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Set Batch Timing (IST)</h3>
            <button
              className="modal-close"
              onClick={() => setShowScheduleModal(false)}
            >
              ×
            </button>
          </div>

          <div className="modal-content">
            <p className="modal-subtitle">
              Define when this batch meets (IST). Students will see this converted automatically into their display time zones.
            </p>

            <div className="schedule-days-section">
              <label className="field-label">Days of the week</label>
              <div className="day-selector">
                {DAYS_OF_WEEK.map((day) => {
                  const currentDays = scheduleForm.days
                    ? scheduleForm.days.split(',').map(d => d.trim()).filter(Boolean)
                    : [];
                  const isSelected = currentDays.includes(day);

                  return (
                    <button
                      key={day}
                      type="button"
                      className={`day-pill ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        const updated = isSelected
                          ? currentDays.filter(d => d !== day)
                          : [...currentDays, day];
                        setScheduleForm({
                          ...scheduleForm,
                          days: updated.join(', ')
                        });
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="schedule-time-section">
              <label className="field-label">Batch time (IST)</label>
              <div className="time-range-inputs">
                <div className="time-input-group">
                  <span className="time-label">Start</span>
                  <input
                    type="time"
                    value={timeRange.start}
                    onChange={(e) => setTimeRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="time-input-group">
                  <span className="time-label">End</span>
                  <input
                    type="time"
                    value={timeRange.end}
                    onChange={(e) => setTimeRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
              <p className="time-hint">Times are saved in IST and converted for students automatically.</p>
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn-cancel"
              onClick={() => setShowScheduleModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn-save"
              onClick={handleSaveSchedule}
            >
              Save Timing
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {showSwitchTrainerModal && createPortal(
      <div className="modal-overlay" onClick={() => setShowSwitchTrainerModal(false)}>
        <div className="modal sky-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Switch trainer</h3>
            <button className="modal-close" onClick={() => setShowSwitchTrainerModal(false)}>×</button>
          </div>
          <div className="modal-content">
            <p className="modal-subtitle">
              Current trainer: <strong>{selectedBatch?.teacherName || 'Unassigned'}</strong>
            </p>
            <label className="field-label">Select new trainer</label>
            <select
              value={selectedTrainerId}
              onChange={(e) => setSelectedTrainerId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d5dee3' }}
            >
              <option value="">Choose a trainer…</option>
              {availableTeachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowSwitchTrainerModal(false)}>Cancel</button>
            <button
              className="sky-btn sky-btn-primary"
              disabled={switchingTrainer || !selectedTrainerId}
              onClick={handleSwitchTrainer}
            >
              {switchingTrainer ? 'Switching…' : 'Confirm switch'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {showAddStudentsModal && createPortal(
      <div className="modal-overlay" onClick={() => {
        setShowAddStudentsModal(false);
        setSelectedStudentIds([]);
      }}>
        <div className="modal add-students-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Add Students to {selectedBatch.name}</h3>
            <button
              className="modal-close"
              onClick={() => {
                setShowAddStudentsModal(false);
                setSelectedStudentIds([]);
              }}
            >
              ×
            </button>
          </div>

          <div className="modal-content">
            <p className="modal-subtitle">Select one or more students to assign to this batch.</p>

            <input
              type="text"
              className="student-search-input"
              placeholder="Search by name or email..."
              value={addStudentsSearch}
              onChange={(e) => setAddStudentsSearch(e.target.value)}
            />

            <div className="students-table-container add-students-table-container">
              <table className="students-table add-students-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Current Batch</th>
                  <th>Course</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {studentsForAddModal.map(student => {
                  const isAlreadyInBatch = normId(student.batchId) === selectedBatchIdNorm;
                  return (
                    <tr key={student.id} className={isAlreadyInBatch ? 'already-in-batch-row' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          disabled={isAlreadyInBatch}
                        />
                      </td>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.batchId || 'None'}</td>
                      <td>{student.course || 'N/A'}</td>
                      <td>
                        {isAlreadyInBatch ? (
                          <span className="status-badge already-added">Already added</span>
                        ) : (
                          <span className="status-badge">Available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                setShowAddStudentsModal(false);
                setSelectedStudentIds([]);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleAddStudentsToBatch}
            >
              Save
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {showStudentDetailsModal && createPortal(
      <div className="fullscreen-modal-overlay" onClick={() => setShowStudentDetailsModal(false)}>
        <div className="fullscreen-modal student-profile-modal" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const s = selectedStudentDetails || {};
            const batchLabel = selectedBatch?.name || s.batchName || 'No batch assigned';
            const lastLoginAt = s.lastLogin?.timestamp
              ? new Date(s.lastLogin.timestamp).toLocaleString()
              : s.lastLoginTimestamp
                ? new Date(s.lastLoginTimestamp).toLocaleString()
                : 'Never';
            const lastIp = s.lastLoginIP || s.lastLogin?.ipAddress || '—';
            const lastLocation = [s.lastLogin?.city, s.lastLogin?.country].filter(Boolean).join(', ') || '—';
            const joinedAt = s.createdAt || s.joinedAt || s.enrolledAt || s.joiningDate;
            return (
              <>
          <div className="fullscreen-modal-header">
            <div className="dossier-header-top">
              <div className="student-header-info">
                <div className="student-avatar">
                  <span className="avatar-text">
                    {(s.name || 'S').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="student-basic-info">
                  <p className="dossier-eyebrow">Candidate profile</p>
                  <h2>{s.name || 'Student'}</h2>
                  <p className="student-email">{s.email || '—'}</p>
                  <div className="student-badges">
                    <span className={`badge ${s.status || 'active'}`}>
                      {s.status || 'Active'}
                    </span>
                    <span className="badge">{s.course || 'No course'}</span>
                    <span className="badge">{batchLabel}</span>
                  </div>
                </div>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="btn-create-report btn-create-report--header"
                  onClick={() => handleDownloadReport('30')}
                  title="Create PDF report (last 30 days)"
                >
                  Create Report
                </button>
                {activeProfileTab === 'profile' && (
                  <button
                    type="button"
                    className="btn-edit-profile"
                    onClick={() => {
                      if (editMode) {
                        handleCancelEdit();
                      } else {
                        setEditMode(true);
                      }
                    }}
                  >
                    {editMode ? 'View profile' : 'Edit profile'}
                  </button>
                )}
                <button
                  type="button"
                  className="modal-close-fullscreen"
                  onClick={() => setShowStudentDetailsModal(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="header-tab-buttons dossier-tabs">
              <button
                type="button"
                className={`header-tab-btn ${activeProfileTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('profile')}
              >
                Profile
              </button>
              <button
                type="button"
                className={`header-tab-btn ${activeProfileTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('activity')}
              >
                Activity
              </button>
              <button
                type="button"
                className={`header-tab-btn ${activeProfileTab === 'reports' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('reports')}
              >
                Reports
              </button>
            </div>
          </div>

          <div className="fullscreen-modal-content">
            {activeProfileTab === 'profile' && (
              <div className="profile-tab-content">
                {editMode ? (
                  <div className="edit-profile-form compact-profile-form">
                    <div className="profile-form-grid">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={editedProfile.name || ''}
                          onChange={(e) => setEditedProfile(prev => ({ ...prev, name: e.target.value }))}
                          className="profile-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Email Address</label>
                        <input
                          type="email"
                          value={editedProfile.email || ''}
                          onChange={(e) => setEditedProfile(prev => ({ ...prev, email: e.target.value }))}
                          className="profile-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Phone Number</label>
                        <input
                          type="tel"
                          value={editedProfile.phone || ''}
                          onChange={(e) => setEditedProfile(prev => ({ ...prev, phone: e.target.value }))}
                          className="profile-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Status</label>
                        <select
                          value={editedProfile.status || 'active'}
                          onChange={(e) => setEditedProfile(prev => ({ ...prev, status: e.target.value }))}
                          className="profile-input"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="on-leave">On Leave</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group full-width">
                      <label>Address</label>
                      <textarea
                        value={editedProfile.address || ''}
                        onChange={(e) => setEditedProfile(prev => ({ ...prev, address: e.target.value }))}
                        className="profile-input"
                        rows="2"
                      />
                    </div>
                    <div className="form-actions compact-form-actions">
                      <button type="button" className="btn-save" onClick={handleSaveProfile}>
                        Save changes
                      </button>
                      <button type="button" className="btn-cancel" onClick={handleCancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="dossier-kpis">
                      <div className="dossier-kpi">
                        <strong>{batchLabel}</strong>
                        <span>Batch</span>
                      </div>
                      <div className="dossier-kpi">
                        <strong>{s.course || '—'}</strong>
                        <span>Program</span>
                      </div>
                      <div className="dossier-kpi">
                        <strong>{lastLoginAt}</strong>
                        <span>Last login</span>
                      </div>
                      <div className="dossier-kpi">
                        <strong>{lastIp}</strong>
                        <span>Last IP</span>
                      </div>
                    </div>

                    <div className="profile-dense-grid">
                      <div className="profile-card profile-card-personal">
                        <h3>Personal information</h3>
                        <div className="profile-details compact-details">
                          <div className="detail-item">
                            <label>Full name</label>
                            <span>{s.name || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Email</label>
                            <span className="truncate-value">{s.email || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Phone</label>
                            <span>{s.phone || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Enrollment no.</label>
                            <span>{s.enrollmentNumber || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Form no.</label>
                            <span>{s.formNumber || '—'}</span>
                          </div>
                          <div className="detail-item wide-detail">
                            <label>Address</label>
                            <span>{s.address || '—'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="profile-card profile-card-academic">
                        <h3>Academic information</h3>
                        <div className="profile-details compact-details">
                          <div className="detail-item">
                            <label>Program</label>
                            <span>{s.course || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Status</label>
                            <span>
                              <span className={`dossier-status ${s.status || 'inactive'}`}>
                                {s.status || '—'}
                              </span>
                            </span>
                          </div>
                          <div className="detail-item">
                            <label>Batch</label>
                            <span>{batchLabel}</span>
                          </div>
                          <div className="detail-item">
                            <label>Role</label>
                            <span style={{ textTransform: 'capitalize' }}>{s.role || 'student'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Student ID</label>
                            <span className="truncate-value">{s.id || s._id || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Joined</label>
                            <span>{joinedAt ? new Date(joinedAt).toLocaleDateString() : '—'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="profile-card profile-card-login">
                        <h3>Login & location</h3>
                        {(s.lastLogin || s.lastLoginIP || s.lastLoginTimestamp) ? (
                          <div className="profile-details compact-details">
                            <div className="detail-item">
                              <label>Last login</label>
                              <span>{lastLoginAt}</span>
                            </div>
                            <div className="detail-item">
                              <label>IP address</label>
                              <span className="ip-address">{lastIp}</span>
                            </div>
                            <div className="detail-item">
                              <label>Location</label>
                              <span>{lastLocation}</span>
                            </div>
                            <div className="detail-item">
                              <label>ISP</label>
                              <span>{s.lastLogin?.isp || '—'}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="no-activity">No login activity recorded yet.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeProfileTab === 'activity' && (
              <div className="activity-tab-content">
                <div className="graph-controls">
                  <div className="control-row">
                    <div className="control-group">
                      <label>Activity Type:</label>
                      <div className="toggle-group">
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={showLogins}
                            onChange={(e) => setShowLogins(e.target.checked)}
                          />
                          <span className="toggle-indicator login"></span>
                          Logins
                        </label>
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={showVideoViews}
                            onChange={(e) => setShowVideoViews(e.target.checked)}
                          />
                          <span className="toggle-indicator video"></span>
                          Video Views
                        </label>
                      </div>
                    </div>
                    <div className="control-group">
                      <label>Date Range:</label>
                      <div className="date-inputs">
                        <input
                          type="date"
                          value={graphDateRange.start || ''}
                          onChange={(e) => setGraphDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="date-input"
                          placeholder="Start date"
                        />
                        <span>to</span>
                        <input
                          type="date"
                          value={graphDateRange.end || ''}
                          onChange={(e) => setGraphDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="date-input"
                          placeholder="End date"
                        />
                      </div>
                    </div>
                    <div className="control-actions">
                      <button
                        type="button"
                        className="btn-download-csv"
                        onClick={handleDownloadGraphCSV}
                      >
                        Download CSV
                      </button>
                    </div>
                  </div>
                </div>

                <div className="activity-graph-section">
                  {loadingActivity ? (
                    <div className="chart-loading">Loading activity data...</div>
                  ) : (
                    <ActivityTimelineChart
                      data={chartData}
                      showLogins={showLogins}
                      showVideoViews={showVideoViews}
                      summary={activitySummary}
                    />
                  )}
                </div>

                <div className="detailed-activity-section">
                  <div className="section-header">
                    <h4>Detailed activity log</h4>
                    <div className="legacy-filters">
                      <select
                        value={activityFilter.action || ''}
                        onChange={(e) => setActivityFilter(prev => ({ ...prev, action: e.target.value }))}
                        className="filter-input"
                      >
                        <option value="">All Actions</option>
                        <option value="login">Login</option>
                        <option value="video_view">Video View</option>
                        <option value="assessment_submit">Assessment Submit</option>
                        <option value="page_view">Page View</option>
                      </select>
                      <button type="button" className="btn-filter" onClick={handleFilterActivity}>
                        Apply filters
                      </button>
                      <button type="button" className="btn-clear" onClick={handleClearActivityFilter}>
                        Clear
                      </button>
                    </div>
                  </div>

                  {studentActivities.length > 0 ? (
                    <>
                      <div className="activity-list compact">
                        {studentActivities.slice(0, 10).map((activity, index) => (
                          <div key={activity.id || index} className="activity-item compact">
                            <div className="activity-header">
                              <span className="activity-action">{activity.action}</span>
                              <span className="activity-timestamp">
                                {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A'}
                              </span>
                            </div>
                            <div className="activity-details">
                              {activity.videoTitle && (
                                <div className="activity-detail">
                                  <label>Video:</label>
                                  <span>{activity.videoTitle}</span>
                                </div>
                              )}
                              {activity.assessmentTitle && (
                                <div className="activity-detail">
                                  <label>Assessment:</label>
                                  <span>{activity.assessmentTitle} (Score: {activity.score})</span>
                                </div>
                              )}
                              {activity.ipAddress && (
                                <div className="activity-detail">
                                  <label>IP:</label>
                                  <span>{activity.ipAddress}</span>
                                </div>
                              )}
                              {(activity.city || activity.country) && (
                                <div className="activity-detail">
                                  <label>Location:</label>
                                  <span>{[activity.city, activity.country].filter(Boolean).join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {studentActivities.length > 10 && (
                        <div className="show-more">
                          <small>Showing first 10 activities of {activityTotal}. Use filters above for more specific results.</small>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="no-activity-data">
                      <p>No activity data found for this student.</p>
                      <small>Try adjusting the filters or date range.</small>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeProfileTab === 'reports' && (
              <div className="reports-tab-content">
                <div className="reports-header">
                  <h3>Student activity reports</h3>
                  <div className="report-actions">
                    <div className="date-range-selector">
                      <label>Report period</label>
                      <select
                        value={reportPeriod}
                        onChange={(e) => setReportPeriod(e.target.value)}
                        className="period-select"
                      >
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 90 Days</option>
                        <option value="custom">Custom Range</option>
                      </select>
                    </div>
                    {reportPeriod === 'custom' && (
                      <div className="custom-date-range">
                        <input
                          type="date"
                          value={customDateRange.start || ''}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="date-input"
                        />
                        <span>to</span>
                        <input
                          type="date"
                          value={customDateRange.end || ''}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="date-input"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn-generate-report"
                      onClick={handleGenerateReport}
                    >
                      Generate summary
                    </button>
                  </div>
                </div>

                <div className="report-content">
                  {reportData ? (
                    <div className="report-summary">
                      <div className="summary-cards">
                        <div className="summary-card">
                          <h4>Total Activities</h4>
                          <span className="summary-value">{reportData.totalActivities || 0}</span>
                        </div>
                        <div className="summary-card">
                          <h4>Video Views</h4>
                          <span className="summary-value">{reportData.videoViews || 0}</span>
                        </div>
                        <div className="summary-card">
                          <h4>Assessments</h4>
                          <span className="summary-value">{reportData.assessments || 0}</span>
                        </div>
                        <div className="summary-card">
                          <h4>Login Days</h4>
                          <span className="summary-value">{reportData.loginDays || 0}</span>
                        </div>
                      </div>
                      <div className="report-actions-bottom">
                        <button
                          type="button"
                          className="btn-create-report btn-create-report--header"
                          onClick={() => handleDownloadReport()}
                        >
                          Download full report (PDF)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="no-report">
                      <p>Select a time period and generate a summary, or use Create Report for a PDF dossier.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
              </>
            );
          })()}
        </div>
      </div>,
      document.body
    )}

    {/* Add Student Modal */}
    {showAddStudentModal && createPortal(
      <div className="modal-overlay" onClick={() => setShowAddStudentModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Add New Student</h2>
            <button className="modal-close" onClick={() => setShowAddStudentModal(false)}>×</button>
          </div>
          
          <div className="modal-content">
            <input
              type="text"
              placeholder="Student full name *"
              value={newStudentForm.name}
              onChange={(e) => setNewStudentForm({...newStudentForm, name: e.target.value})}
              required
            />
            <input
              type="email"
              placeholder="Enter student email address *"
              value={newStudentForm.email}
              onChange={(e) => setNewStudentForm({...newStudentForm, email: e.target.value})}
              required
              autoComplete="off"
              readOnly
              onFocus={(e) => e.target.removeAttribute('readonly')}
              onBlur={(e) => e.target.setAttribute('readonly', true)}
            />
            <input
              type="password"
              placeholder="Create password for student *"
              value={newStudentForm.password}
              onChange={(e) => setNewStudentForm({...newStudentForm, password: e.target.value})}
              required
              autoComplete="off"
              readOnly
              onFocus={(e) => e.target.removeAttribute('readonly')}
              onBlur={(e) => e.target.setAttribute('readonly', true)}
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={newStudentForm.phone}
              onChange={(e) => setNewStudentForm({...newStudentForm, phone: e.target.value})}
            />
            <textarea
              placeholder="Address"
              value={newStudentForm.address}
              onChange={(e) => setNewStudentForm({...newStudentForm, address: e.target.value})}
              rows="2"
            />
            <select
              value={newStudentForm.course}
              onChange={(e) => handleCourseChange(e.target.value)}
              required
            >
              <option value="">Select Course *</option>
              {courses.map(course => (
                <option key={course.id || course.title} value={course.title || course}>
                  {course.title || course}
                </option>
              ))}
            </select>
            <select
              value={newStudentForm.batchId}
              onChange={(e) => setNewStudentForm({...newStudentForm, batchId: e.target.value})}
              required
              disabled={!newStudentForm.course}
            >
              <option value="">
                {newStudentForm.course ? 'Select Batch *' : 'Select Course First'}
              </option>
              {availableBatches.map(batch => (
                <option key={batch.id || batch._id} value={batch.id || batch._id}>
                  {batch.name}
                </option>
              ))}
            </select>
            <select
              value={newStudentForm.status}
              onChange={(e) => setNewStudentForm({...newStudentForm, status: e.target.value})}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on-leave">On Leave</option>
            </select>
          </div>

          <div className="modal-actions">
            <button
              className="btn-secondary"
              onClick={() => setShowAddStudentModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleAddNewStudent}
            >
              Add Student
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Toast Notifications - Rendered via portal for proper stacking */}
    {createPortal(<ToastContainer />, document.body)}
    </>
  );
};

export default BatchDetailsPage;
