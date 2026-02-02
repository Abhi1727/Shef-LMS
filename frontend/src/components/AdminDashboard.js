import React, { useState, useEffect } from 'react';
import { firebaseService, COLLECTIONS } from '../services/firebaseService';
import { where } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { ToastContainer, showToast } from './Toast';
import fallbackData from '../data/fallbackData';
import './AdminDashboard.css';

const AdminDashboard = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [classroomVideos, setClassroomVideos] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [stats, setStats] = useState({});
  const [domains, setDomains] = useState([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  // Reset form when modal type changes to prevent data leakage
  useEffect(() => {
    if (modalType && !editingItem) {
      // Only reset if we're not editing an existing item
      const cleanDefaults = getDefaultFormData(modalType);
      cleanDefaults.email = '';
      cleanDefaults.password = '';
      setFormData(cleanDefaults);
    }
  }, [modalType]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      // Load all data via API calls
      const [
        studentsRes,
        teachersRes,
        coursesRes,
        modulesRes,
        lessonsRes,
        projectsRes,
        assessmentsRes,
        jobsRes,
        mentorsRes,
        classroomRes,
        liveClassesRes
      ] = await Promise.all([
        fetch(`${apiUrl}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/teachers`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/courses`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/modules`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/lessons`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/projects`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/assessments`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/jobs`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/mentors`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/admin/classroom`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const studentsData = studentsRes.ok ? await studentsRes.json() : fallbackData.users;
      const teachersData = teachersRes.ok ? await teachersRes.json() : fallbackData.teachers;
      const coursesData = coursesRes.ok ? await coursesRes.json() : fallbackData.courses;
      const modulesData = modulesRes.ok ? await modulesRes.json() : [];
      const lessonsData = lessonsRes.ok ? await lessonsRes.json() : [];
      const projectsData = projectsRes.ok ? await projectsRes.json() : [];
      const assessmentsData = assessmentsRes.ok ? await assessmentsRes.json() : [];
      const jobsData = jobsRes.ok ? await jobsRes.json() : [];
      const mentorsData = mentorsRes.ok ? await mentorsRes.json() : [];
      const classroomData = classroomRes.ok ? await classroomRes.json() : fallbackData.classroom;

      setStudents(studentsData);
      setTeachers(teachersData);
      setCourses(coursesData);
      setModules(modulesData);
      setLessons(lessonsData);
      setProjects(projectsData);
      setAssessments(assessmentsData);
      setJobs(jobsData);
      setMentors(mentorsData);
      setClassroomVideos(classroomData);

      // Calculate stats using safe fallbacks
      calculateStats(studentsData, coursesData, jobsData);

      // Set domains for teacher selection based on available courses
      const courseTitles = coursesData.map(course => course.title || course.name);
      setDomains(courseTitles);

      // Show warning if using fallback data
      if (!studentsRes.ok || !teachersRes.ok || !coursesRes.ok) {
        showToast('⚠️ Using demo data - Firebase quota exceeded. Contact admin to upgrade Firebase plan.', 'warning');
      }

    } catch (error) {
      console.error('Error loading admin data:', error);
      
      // Use fallback data on complete failure
      setStudents(fallbackData.users);
      setTeachers(fallbackData.teachers);
      setCourses(fallbackData.courses);
      setModules([]);
      setLessons([]);
      setProjects([]);
      setAssessments([]);
      setJobs([]);
      setMentors([]);
      setClassroomVideos(fallbackData.classroom);
      
      calculateStats(fallbackData.users, fallbackData.courses, []);
      
      showToast('⚠️ Using demo data - Firebase quota exceeded. Contact admin to upgrade Firebase plan.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (studentData, courseData, jobData) => {
    const totalStudents = studentData.length;
    const activeStudents = studentData.filter(s => s.status === 'active').length;
    const totalCourses = courseData.length;
    const activeJobs = jobData.filter(j => j.status === 'active').length;
    const totalRevenue = studentData.reduce((sum, s) => sum + (s.tuitionPaid || 0), 0);

    setStats({
      totalStudents,
      activeStudents,
      totalCourses,
      activeJobs,
      totalRevenue,
      completionRate: totalStudents > 0 ? ((activeStudents / totalStudents) * 100).toFixed(1) : 0
    });
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    
    // Force clean form data for new items (no editing)
    if (!item) {
      const cleanDefaults = getDefaultFormData(type);
      // Ensure email and password are always empty for new users
      cleanDefaults.email = '';
      cleanDefaults.password = '';
      setFormData(cleanDefaults);
    } else {
      setFormData(item);
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setEditingItem(null);
    // Force complete form reset
    setFormData({
      name: '',
      email: '',
      password: '',
      enrollmentNumber: '',
      course: '',
      status: 'active',
      role: 'student',
      phone: '',
      address: '',
      age: '',
      domain: '',
      experience: '',
      title: '',
      company: '',
      linkedin: '',
      bio: '',
      skills: []
    });
  };

  const getDefaultFormData = (type) => {
    const defaults = {
      student: { name: '', email: '', password: '', enrollmentNumber: '', course: '', status: 'active', role: 'student', phone: '', address: '' },
      teacher: { name: '', email: '', password: '', age: '', domain: '', experience: '', status: 'active', role: 'teacher', phone: '', address: '' },
      course: { title: '', description: '', duration: '', modules: 0, status: 'active', instructor: '', price: '' },
      module: { name: '', courseId: '', description: '', duration: '', lessons: 0, order: 1 },
  lesson: { title: '', moduleId: '', content: '', duration: '', videoUrl: '', classLink: '', order: 1, resources: '' },
      project: { title: '', description: '', difficulty: 'Intermediate', duration: '', skills: [], requirements: '', deliverables: '' },
      assessment: { title: '', description: '', questions: 0, duration: '', difficulty: 'Medium', passingScore: 70 },
      job: { title: '', company: '', location: 'Remote', salary: '', type: 'Full-time', status: 'active', skills: [], description: '' },
      mentor: { name: '', title: '', company: '', experience: '', skills: [], bio: '', email: '', password: '', domain: '', linkedin: '' },
      content: { type: 'announcement', title: '', content: '', targetAudience: 'all', priority: 'normal' },
      classroom: { title: '', date: '', instructor: '', duration: '', zoomUrl: '', zoomPasscode: '', driveId: '', courseType: 'Data Science & AI', type: 'Live Class', videoSource: 'firebase' },
      liveClass: { title: '', course: 'Data Science & AI', scheduledDate: '', scheduledTime: '', duration: '60 mins', instructor: '', meetingType: 'auto', status: 'scheduled', description: '' }
    };
    return defaults[type] || {};
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Validate required fields
      if (modalType === 'student') {
        if (!formData.name || !formData.email || (!editingItem && !formData.password) || !formData.enrollmentNumber || !formData.course) {
          showToast('Please fill in all required fields (Name, Email, Password, Enrollment Number, Course)', 'warning');
          return;
        }

        // Special handling for student creation/update with password
        if (!editingItem) {
          // Creating new student - hash password before storing
          try {
            // Check if email already exists via API
            const token = localStorage.getItem('token');
            const usersResponse = await fetch('/api/admin/users', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (usersResponse.ok) {
              const existingUsers = await usersResponse.json();
              const emailExists = existingUsers.some(user => user.email === formData.email);
              if (emailExists) {
                showToast('A student with this email already exists!', 'error');
                return;
              }
            }

            // Prepare student data (password will be hashed on backend)
            const studentData = {
              name: formData.name,
              email: formData.email,
              password: formData.password, // Send plain text, backend will hash
              enrollmentNumber: formData.enrollmentNumber,
              phone: formData.phone || '',
              address: formData.address || '',
              course: formData.course || '',
              status: formData.status || 'active',
              role: 'student'
            };

            const createResponse = await fetch('/api/admin/users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(studentData)
            });
            
            if (createResponse.ok) {
              showToast('Student created successfully! Email: ' + formData.email, 'success');
              closeModal();
              await loadAllData();
            } else {
              const errorData = await createResponse.json();
              showToast('Error: ' + (errorData.message || 'Failed to create student'), 'error');
            }
            return;
          } catch (error) {
            showToast('Failed to create student: ' + error.message, 'error');
            return;
          }
        } else {
          // Editing existing student
          const updateData = {
            name: formData.name,
            email: formData.email,
            enrollmentNumber: formData.enrollmentNumber,
            phone: formData.phone || '',
            address: formData.address || '',
            course: formData.course || '',
            status: formData.status || 'active'
          };
          
          // Password cannot be updated during edit for security
          // User should use password reset feature
          
          const token = localStorage.getItem('token');
          const updateResponse = await fetch(`/api/admin/users/${editingItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
          });

          if (updateResponse.ok) {
            showToast('Student updated successfully!', 'success');
            closeModal();
            await loadAllData();
          } else {
            const errorData = await updateResponse.json();
            showToast('Error: ' + (errorData.message || 'Failed to update student'), 'error');
          }
          return;
        }
      } else if (modalType === 'teacher') {
        if (!formData.name || !formData.email || (!editingItem && !formData.password) || !formData.domain) {
          showToast('Please fill in all required fields (Name, Email, Password, Domain)', 'warning');
          return;
        }

        // Special handling for teacher creation/update with password
        if (!editingItem) {
          // Creating new teacher - hash password before storing
          try {
            // Check if email already exists via API
            const token = localStorage.getItem('token');
            const teachersResponse = await fetch('/api/admin/teachers', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (teachersResponse.ok) {
              const existingTeachers = await teachersResponse.json();
              const emailExists = existingTeachers.some(teacher => teacher.email === formData.email);
              if (emailExists) {
                showToast('A teacher with this email already exists!', 'error');
                return;
              }
            }

            // Prepare teacher data (password will be hashed on backend)
            const teacherData = {
              name: formData.name,
              email: formData.email,
              password: formData.password, // Send plain text, backend will hash
              age: formData.age || null,
              domain: formData.domain,
              experience: formData.experience || '',
              phone: formData.phone || '',
              address: formData.address || '',
              status: formData.status || 'active',
              role: 'teacher'
            };

            const createResponse = await fetch('/api/admin/teachers', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(teacherData)
            });

            if (createResponse.ok) {
              showToast('Teacher created successfully!', 'success');
              closeModal();
              await loadAllData();
            } else {
              const errorData = await createResponse.json();
              showToast('Error: ' + (errorData.message || 'Failed to create teacher'), 'error');
            }
            return;
          } catch (error) {
            console.error('Error creating teacher:', error);
            showToast('Error creating teacher. Please try again.', 'error');
            return;
          }
        } else {
          // Updating existing teacher
          const updateData = {
            name: formData.name,
            email: formData.email,
            age: formData.age || null,
            domain: formData.domain,
            experience: formData.experience || '',
            phone: formData.phone || '',
            address: formData.address || '',
            status: formData.status || 'active'
          };

          // Password cannot be updated during edit for security
          // User should use password reset feature

          const token = localStorage.getItem('token');
          const updateResponse = await fetch(`/api/admin/teachers/${editingItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
          });

          if (updateResponse.ok) {
            showToast('Teacher updated successfully!', 'success');
            closeModal();
            await loadAllData();
          } else {
            const errorData = await updateResponse.json();
            showToast('Error: ' + (errorData.message || 'Failed to update teacher'), 'error');
          }
          return;
        }
      } else if (modalType === 'mentor') {
        if (!formData.name || !formData.title || !formData.company || !formData.email || (!editingItem && !formData.password) || !formData.domain) {
          showToast('Please fill in all required fields (Name, Job Title, Company, Email, Password, Domain)', 'warning');
          return;
        }

        // Special handling for mentor creation/update with password
        if (!editingItem) {
          // Creating new mentor - hash password before storing
          try {
            // Check if email already exists via API
            const token = localStorage.getItem('token');
            const mentorsResponse = await fetch('/api/admin/mentors', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (mentorsResponse.ok) {
              const existingMentors = await mentorsResponse.json();
              const emailExists = existingMentors.some(mentor => mentor.email === formData.email);
              if (emailExists) {
                showToast('A mentor with this email already exists!', 'error');
                return;
              }
            }

            // Prepare mentor data (password will be hashed on backend)
            const mentorData = {
              name: formData.name,
              email: formData.email,
              password: formData.password, // Send plain text, backend will hash
              title: formData.title,
              company: formData.company,
              domain: formData.domain,
              bio: formData.bio || '',
              linkedin: formData.linkedin || '',
              status: formData.status || 'active',
              role: 'mentor'
            };

            const createResponse = await fetch('/api/admin/mentors', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(mentorData)
            });
            
            if (createResponse.ok) {
              showToast('Mentor created successfully! Email: ' + formData.email, 'success');
              closeModal();
              await loadAllData();
            } else {
              const errorData = await createResponse.json();
              showToast('Error: ' + (errorData.message || 'Failed to create mentor'), 'error');
            }
            return;
          } catch (error) {
            showToast('Failed to create mentor: ' + error.message, 'error');
            return;
          }
        } else {
          // Editing existing mentor
          const updateData = {
            name: formData.name,
            email: formData.email,
            title: formData.title,
            company: formData.company,
            domain: formData.domain,
            bio: formData.bio || '',
            linkedin: formData.linkedin || '',
            status: formData.status || 'active'
          };
          
          // Password cannot be updated during edit for security
          // User should use password reset feature
          
          const token = localStorage.getItem('token');
          const updateResponse = await fetch(`/api/admin/mentors/${editingItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
          });

          if (updateResponse.ok) {
            showToast('Mentor updated successfully!', 'success');
            closeModal();
            await loadAllData();
          } else {
            const errorData = await updateResponse.json();
            showToast('Error: ' + (errorData.message || 'Failed to update mentor'), 'error');
          }
          return;
        }
      } else if (modalType === 'course') {
        if (!formData.title || !formData.description) {
          showToast('Please fill in all required fields (Title, Description)', 'warning');
          return;
        }
      } else if (modalType === 'module') {
        if (!formData.name || !formData.courseId) {
          showToast('Please fill in all required fields (Name, Course)', 'warning');
          return;
        }
      } else if (modalType === 'lesson') {
        if (!formData.title || !formData.moduleId || !formData.content) {
          showToast('Please fill in all required fields (Title, Module, Content)', 'warning');
          return;
        }
      } else if (modalType === 'project') {
        if (!formData.title || !formData.description) {
          showToast('Please fill in all required fields (Title, Description)', 'warning');
          return;
        }
      } else if (modalType === 'assessment') {
        if (!formData.title) {
          showToast('Please fill in the Assessment Title', 'warning');
          return;
        }
      } else if (modalType === 'job') {
        if (!formData.title || !formData.company) {
          showToast('Please fill in all required fields (Job Title, Company)', 'warning');
          return;
        }
      } else if (modalType === 'mentor') {
        if (!formData.name || !formData.title || !formData.company || !formData.email || (!editingItem && !formData.password) || !formData.domain) {
          showToast('Please fill in all required fields (Name, Job Title, Company, Email, Password, Domain)', 'warning');
          return;
        }
      } else if (modalType === 'content') {
        if (!formData.title || !formData.content) {
          showToast('Please fill in all required fields (Title, Content)', 'warning');
          return;
        }
      }

      // Validate classroom fields
      if (modalType === 'classroom') {
        if (!formData.title || !formData.instructor || !formData.courseType) {
          showToast('Please fill in required fields (Title, Instructor, Course Type)', 'warning');
          return;
        }
        
        // Validate Firebase Storage requirements
        if (!formData.videoFile || !formData.courseId) {
          showToast('Please provide video file and course ID for Firebase Storage uploads', 'warning');
          return;
        }
      }

      // Validate live class fields
      if (modalType === 'liveClass') {
        if (!formData.title || !formData.course || !formData.scheduledDate || !formData.scheduledTime) {
          showToast('Please fill in required fields (Title, Course, Date, Time)', 'warning');
          return;
        }
        
        // Create Zoom meeting if not editing
        if (!editingItem) {
          try {
            // Combine date and time to ISO format for Zoom
            const startTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toISOString();
            const duration = parseInt(formData.duration) || 60;
            
            const token = localStorage.getItem('token');
            const zoomResponse = await fetch('/api/zoom/meetings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                topic: formData.title,
                startTime: startTime,
                duration: duration,
                agenda: formData.description || '',
                courseId: formData.course,
                timezone: 'Asia/Kolkata'
              })
            });
            
            const zoomData = await zoomResponse.json();
            
            if (zoomData.success) {
              showToast('Zoom meeting created successfully!', 'success');
              closeModal();
              await loadAllData();
              return;
            } else {
              showToast('Error creating Zoom meeting: ' + zoomData.message, 'error');
              return;
            }
          } catch (error) {
            console.error('Error creating Zoom meeting:', error);
            showToast('Failed to create Zoom meeting. Please try again.', 'error');
            return;
          }
        }
      }

      // Special handling for classroom videos - Firebase Storage, YouTube Upload, or Manual URL
      if (modalType === 'classroom') {
        try {
          const token = localStorage.getItem('token');
          const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
          
          if (formData.videoSource === 'youtube-url') {
            // Handle manual YouTube URL
            if (!formData.youtubeUrl) {
              showToast('YouTube URL is required for manual YouTube URL option', 'error');
              return;
            }

            // Import YouTube utility
            const { YouTubeUtils } = require('../utils/youtubeUtils');
            const videoId = YouTubeUtils.extractVideoId(formData.youtubeUrl);
            
            if (!videoId) {
              showToast('Invalid YouTube URL. Please use a valid YouTube video URL.', 'error');
              return;
            }

            // Create lecture data for manual YouTube URL via API
            const lectureData = {
              title: formData.title,
              instructor: formData.instructor,
              description: formData.description || '',
              courseId: formData.courseId,
              batchId: formData.batchId || '',
              domain: formData.domain || '',
              duration: formData.duration || '',
              courseType: formData.courseType || '',
              type: formData.type || 'Lecture',
              date: formData.date || new Date().toISOString().split('T')[0],
              videoSource: 'youtube-url',
              youtubeVideoId: videoId,
              youtubeVideoUrl: formData.youtubeUrl,
              youtubeEmbedUrl: YouTubeUtils.getEmbedUrl(videoId)
            };

            // Save via API
            const response = await fetch(`${apiUrl}/api/admin/classroom/youtube-url`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(lectureData)
            });

            const data = await response.json();

            if (response.ok) {
              showToast('YouTube video added successfully!', 'success');
              closeModal();
              await loadAllData();
              return;
            } else {
              showToast('Error: ' + (data.message || 'Failed to save YouTube video'), 'error');
              return;
            }

          } else {
            // Handle file uploads (Firebase or YouTube Upload)
            const formDataObj = new FormData();
            formDataObj.append('video', formData.videoFile);
            formDataObj.append('title', formData.title);
            formDataObj.append('description', formData.description || '');
            formDataObj.append('courseId', formData.courseId);
            formDataObj.append('batchId', formData.batchId || '');
            formDataObj.append('domain', formData.domain || '');
            formDataObj.append('duration', formData.duration || '');
            formDataObj.append('courseType', formData.courseType || '');
            formDataObj.append('instructor', formData.instructor || '');
            
            // Choose endpoint based on video source
            const uploadEndpoint = formData.videoSource === 'youtube' 
              ? `${apiUrl}/api/admin/classroom/youtube-upload`
              : `${apiUrl}/api/admin/classroom/upload`;
            
            const response = await fetch(uploadEndpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formDataObj
            });

            const data = await response.json();

            if (response.ok) {
              const successMessage = formData.videoSource === 'youtube'
                ? 'YouTube video uploaded successfully! Video is set to private.'
                : 'Firebase Storage video uploaded successfully!';
              showToast(successMessage, 'success');
              closeModal();
              await loadAllData();
              return;
            } else {
              const errorMessage = formData.videoSource === 'youtube'
                ? (data.message || 'Failed to upload video to YouTube')
                : (data.message || 'Failed to upload video to Firebase Storage');
              showToast('Error: ' + errorMessage, 'error');
              return;
            }
          }
        } catch (error) {
          console.error('Error saving classroom video:', error);
          const errorMessage = formData.videoSource === 'youtube-url'
            ? 'Failed to save YouTube video. Please check the URL and try again.'
            : (formData.videoSource === 'youtube'
              ? 'Failed to upload video to YouTube. Please check your API configuration.'
              : 'Failed to save classroom video. Please try again.');
          showToast(errorMessage, 'error');
          return;
        }
      }

      const collectionMap = {
        student: 'users',
        course: 'courses',
        module: 'modules',
        lesson: 'lessons',
        project: 'projects',
        assessment: 'assessments',
        job: 'jobs',
        mentor: 'mentors',
        content: 'content',
        classroom: 'classroom',
        liveClass: 'liveClasses'
      };
      const collection = collectionMap[modalType];

      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      let result;

      if (editingItem?.id) {
        const updateResponse = await fetch(`${apiUrl}/api/admin/${collection}/${editingItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
        result = { success: updateResponse.ok, error: updateResponse.ok ? null : (await updateResponse.json()).message };
      } else {
        const createResponse = await fetch(`${apiUrl}/api/admin/${collection}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
        result = { success: createResponse.ok, error: createResponse.ok ? null : (await createResponse.json()).message };
      }

      if (result.success) {
        showToast(editingItem ? 'Updated successfully!' : 'Created successfully!', 'success');
        closeModal();
        await loadAllData();
      } else {
        showToast('Error: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save data: ' + error.message);
    }
    finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collection, id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        const token = localStorage.getItem('token');
        
        // Map collection names to API endpoints
        const collectionMap = {
          [COLLECTIONS.USERS]: 'users',
          'teachers': 'teachers',
          [COLLECTIONS.COURSES]: 'courses',
          [COLLECTIONS.MODULES]: 'modules',
          [COLLECTIONS.LESSONS]: 'lessons',
          [COLLECTIONS.PROJECTS]: 'projects',
          [COLLECTIONS.ASSESSMENTS]: 'assessments',
          [COLLECTIONS.JOBS]: 'jobs',
          [COLLECTIONS.MENTORS]: 'mentors',
          [COLLECTIONS.CONTENT]: 'content',
          [COLLECTIONS.CLASSROOM]: 'classroom',
          [COLLECTIONS.LIVE_CLASSES]: 'liveClasses'
        };
        
        const apiEndpoint = collectionMap[collection];
        if (!apiEndpoint) {
          showToast('Unknown collection type', 'error');
          return;
        }

        const response = await fetch(`/api/admin/${apiEndpoint}/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          showToast('Deleted successfully!', 'success');
          await loadAllData();
        } else {
          const data = await response.json();
          showToast('Error: ' + (data.message || 'Failed to delete item'), 'error');
        }
      } catch (error) {
        console.error('Error deleting item:', error);
        showToast('Failed to delete item. Please try again.', 'error');
      }
    }
  };

  // Sync Zoom recordings to classroom
  const handleSyncRecordings = async () => {
    try {
      setSaving(true);
      showToast('Syncing Zoom recordings...', 'info');

      const response = await fetch('/api/zoom/sync-recordings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        showToast(`✅ ${data.message}`, 'success');
        // Reload classroom data to show new recordings
        await loadAllData();
      } else {
        showToast(`❌ ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('Error syncing recordings:', error);
      showToast('Failed to sync recordings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="admin-sidebar open">
        <div className="sidebar-header">
          <div className="logo">
            <h2>LMS</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            <span className="icon">📊</span>
            <span>Overview</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'students' ? 'active' : ''}`}
            onClick={() => setActiveSection('students')}
          >
            <span className="icon">👥</span>
            <span>Students</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'teachers' ? 'active' : ''}`}
            onClick={() => setActiveSection('teachers')}
          >
            <span className="icon">👨‍🏫</span>
            <span>Teachers</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveSection('courses')}
          >
            <span className="icon">📚</span>
            <span>Courses</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'modules' ? 'active' : ''}`}
            onClick={() => setActiveSection('modules')}
          >
            <span className="icon">📖</span>
            <span>Modules</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'lessons' ? 'active' : ''}`}
            onClick={() => setActiveSection('lessons')}
          >
            <span className="icon">📝</span>
            <span>Lessons</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'classroom' ? 'active' : ''}`}
            onClick={() => setActiveSection('classroom')}
          >
            <span className="icon">🎥</span>
            <span>Classroom</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'liveClasses' ? 'active' : ''}`}
            onClick={() => setActiveSection('liveClasses')}
          >
            <span className="icon">📡</span>
            <span>Live Classes</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveSection('projects')}
          >
            <span className="icon">📁</span>
            <span>Projects</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'assessments' ? 'active' : ''}`}
            onClick={() => setActiveSection('assessments')}
          >
            <span className="icon">✏️</span>
            <span>Assessments</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveSection('jobs')}
          >
            <span className="icon">💼</span>
            <span>Job Board</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'mentors' ? 'active' : ''}`}
            onClick={() => setActiveSection('mentors')}
          >
            <span className="icon">👨‍🏫</span>
            <span>Mentors</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'content' ? 'active' : ''}`}
            onClick={() => setActiveSection('content')}
          >
            <span className="icon">📢</span>
            <span>Content</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveSection('analytics')}
          >
            <span className="icon">📈</span>
            <span>Analytics</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            <span className="icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>



      {/* Main Content */}
      <main className="admin-main-content sidebar-open">
        {/* Top Header */}
        <header className="admin-top-header">
          <div className="header-left">
            <h1 className="page-title">LMS Admin Dashboard</h1>
          </div>
          <div className="header-right">
            <div className="user-menu">
              <button className="notification-btn">🔔</button>
              <div className="user-avatar">
                {user?.name?.charAt(0)}
              </div>
              <span className="user-name">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="admin-content">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="admin-section">
              <h2>Dashboard Overview</h2>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">👥</div>
                  <div className="stat-info">
                    <h3>{stats.totalStudents || 0}</h3>
                    <p>Total Students</p>
                    <span className="stat-change positive">+{stats.activeStudents || 0} active</span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">📚</div>
                  <div className="stat-info">
                    <h3>{stats.totalCourses || 0}</h3>
                    <p>Total Courses</p>
                    <span className="stat-change">Available</span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">💼</div>
                  <div className="stat-info">
                    <h3>{stats.activeJobs || 0}</h3>
                    <p>Active Jobs</p>
                    <span className="stat-change positive">Open positions</span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">📈</div>
                  <div className="stat-info">
                    <h3>{stats.completionRate || 0}%</h3>
                    <p>Completion Rate</p>
                    <span className="stat-change">Overall progress</span>
                  </div>
                </div>
              </div>

              <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="actions-grid">
                  <button onClick={() => openModal('student')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Student</span>
                  </button>
                  <button onClick={() => openModal('teacher')} className="action-btn">
                    <span className="icon">👨‍🏫</span>
                    <span>Add Teacher</span>
                  </button>
                  <button onClick={() => openModal('course')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Course</span>
                  </button>
                  <button onClick={() => openModal('job')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Job</span>
                  </button>
                  <button onClick={() => openModal('mentor')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Mentor</span>
                  </button>
                  <button onClick={() => openModal('content')} className="action-btn">
                    <span className="icon">📢</span>
                    <span>Post Announcement</span>
                  </button>
                  <button onClick={() => setActiveSection('analytics')} className="action-btn">
                    <span className="icon">📊</span>
                    <span>View Analytics</span>
                  </button>
                </div>
              </div>

              <div className="recent-activity">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  <div className="activity-item">
                    <span className="activity-icon">👤</span>
                    <div className="activity-content">
                      <p><strong>New student enrolled</strong></p>
                      <span className="activity-time">2 hours ago</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <span className="activity-icon">📚</span>
                    <div className="activity-content">
                      <p><strong>Course updated</strong></p>
                      <span className="activity-time">5 hours ago</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <span className="activity-icon">💼</span>
                    <div className="activity-content">
                      <p><strong>New job posted</strong></p>
                      <span className="activity-time">1 day ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Students Section */}
          {activeSection === 'students' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Students</h2>
                <button onClick={() => openModal('student')} className="btn-add">
                  ➕ Add Student
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Enrollment No.</th>
                      <th>Course</th>
                      <th>Last Login IP</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.email}</td>
                        <td>{student.enrollmentNumber}</td>
                        <td>{student.course || 'N/A'}</td>
                        <td>
                          <span className="ip-address" title={student.lastLogin?.timestamp || 'Never logged in'}>
                            {student.lastLogin?.ipAddress || student.lastLoginIP || 'N/A'}
                          </span>
                        </td>
                        <td>
                          {student.lastLogin?.city && student.lastLogin?.country 
                            ? `${student.lastLogin.city}, ${student.lastLogin.country}`
                            : 'N/A'}
                        </td>
                        <td>
                          <span className={`status-badge ${student.status}`}>
                            {student.status}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => openModal('student', student)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete(COLLECTIONS.USERS, student.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {students.length === 0 && <p className="no-data">No students found. Add your first student!</p>}
              </div>
            </div>
          )}

          {/* Teachers Section */}
          {activeSection === 'teachers' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Teachers</h2>
                <button onClick={() => openModal('teacher')} className="btn-add">
                  ➕ Add Teacher
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Age</th>
                      <th>Domain</th>
                      <th>Experience</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map(teacher => (
                      <tr key={teacher.id}>
                        <td>{teacher.name}</td>
                        <td>{teacher.email}</td>
                        <td>{teacher.age || 'N/A'}</td>
                        <td>{teacher.domain || 'N/A'}</td>
                        <td>{teacher.experience || 'N/A'}</td>
                        <td>{teacher.phone || 'N/A'}</td>
                        <td>
                          <span className={`status-badge ${teacher.status}`}>
                            {teacher.status}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => openModal('teacher', teacher)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete('teachers', teacher.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {teachers.length === 0 && <p className="no-data">No teachers found. Add your first teacher!</p>}
              </div>
            </div>
          )}

          {/* Courses Section */}
          {activeSection === 'courses' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Courses</h2>
                <button onClick={() => openModal('course')} className="btn-add">
                  ➕ Add Course
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Description</th>
                      <th>Duration</th>
                      <th>Modules</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map(course => (
                      <tr key={course.id}>
                        <td>{course.title}</td>
                        <td>{course.description?.substring(0, 50)}...</td>
                        <td>{course.duration}</td>
                        <td>{course.modules}</td>
                        <td>
                          <span className={`status-badge ${course.status}`}>
                            {course.status}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => openModal('course', course)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete(COLLECTIONS.COURSES, course.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {courses.length === 0 && <p className="no-data">No courses found. Create your first course!</p>}
              </div>
            </div>
          )}

          {/* Modules Section */}
          {activeSection === 'modules' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Modules</h2>
                <button onClick={() => openModal('module')} className="btn-add">
                  ➕ Add Module
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Module Name</th>
                      <th>Course</th>
                      <th>Duration</th>
                      <th>Lessons</th>
                      <th>Order</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map(module => (
                      <tr key={module.id}>
                        <td>{module.name}</td>
                        <td>{courses.find(c => c.id === module.courseId)?.title || 'N/A'}</td>
                        <td>{module.duration}</td>
                        <td>{module.lessons}</td>
                        <td>{module.order}</td>
                        <td>
                          <button onClick={() => openModal('module', module)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete(COLLECTIONS.MODULES, module.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {modules.length === 0 && <p className="no-data">No modules found. Add modules to your courses!</p>}
              </div>
            </div>
          )}

          {/* Lessons Section */}
          {activeSection === 'lessons' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Lessons</h2>
                <button onClick={() => openModal('lesson')} className="btn-add">
                  ➕ Add Lesson
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lesson Title</th>
                      <th>Module</th>
                      <th>Duration</th>
                      <th>Order</th>
                      <th>Class</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map(lesson => (
                      <tr key={lesson.id}>
                        <td>{lesson.title}</td>
                        <td>{modules.find(m => m.id === lesson.moduleId)?.name || 'N/A'}</td>
                        <td>{lesson.duration}</td>
                        <td>{lesson.order}</td>
                        <td>
                          {lesson.classLink ? (
                            <a href={lesson.classLink} target="_blank" rel="noopener noreferrer" className="btn-join">Join</a>
                          ) : (
                            <span className="no-class">—</span>
                          )}
                        </td>
                        <td>
                          <button onClick={() => openModal('lesson', lesson)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete(COLLECTIONS.LESSONS, lesson.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lessons.length === 0 && <p className="no-data">No lessons found. Start adding lessons to modules!</p>}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {activeSection === 'projects' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Projects</h2>
                <button onClick={() => openModal('project')} className="btn-add">
                  ➕ Add Project
                </button>
              </div>

              <div className="cards-grid">
                {projects.map(project => (
                  <div key={project.id} className="project-card">
                    <h3>{project.title}</h3>
                    <p>{project.description}</p>
                    <div className="project-meta">
                      <span className="badge">{project.difficulty}</span>
                      <span>⏱️ {project.duration}</span>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => openModal('project', project)} className="btn-edit">✏️ Edit</button>
                      <button onClick={() => handleDelete(COLLECTIONS.PROJECTS, project.id)} className="btn-delete">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {projects.length === 0 && <p className="no-data">No projects found. Add capstone projects!</p>}
            </div>
          )}

          {/* Assessments Section */}
          {activeSection === 'assessments' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Assessments</h2>
                <button onClick={() => openModal('assessment')} className="btn-add">
                  ➕ Add Assessment
                </button>
              </div>

              <div className="cards-grid">
                {assessments.map(assessment => (
                  <div key={assessment.id} className="assessment-card">
                    <h3>{assessment.title}</h3>
                    <p>{assessment.description}</p>
                    <div className="assessment-meta">
                      <span>{assessment.questions} Questions</span>
                      <span>⏱️ {assessment.duration}</span>
                      <span className="badge">{assessment.difficulty}</span>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => openModal('assessment', assessment)} className="btn-edit">✏️ Edit</button>
                      <button onClick={() => handleDelete(COLLECTIONS.ASSESSMENTS, assessment.id)} className="btn-delete">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {assessments.length === 0 && <p className="no-data">No assessments found. Create practice tests!</p>}
            </div>
          )}

          {/* Jobs Section */}
          {activeSection === 'jobs' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Job Board</h2>
                <button onClick={() => openModal('job')} className="btn-add">
                  ➕ Add Job
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Title</th>
                      <th>Company</th>
                      <th>Location</th>
                      <th>Salary</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <tr key={job.id}>
                        <td>{job.title}</td>
                        <td>{job.company}</td>
                        <td>{job.location}</td>
                        <td>{job.salary}</td>
                        <td>{job.type}</td>
                        <td>
                          <span className={`status-badge ${job.status}`}>
                            {job.status}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => openModal('job', job)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete(COLLECTIONS.JOBS, job.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {jobs.length === 0 && <p className="no-data">No jobs found. Post job opportunities!</p>}
              </div>
            </div>
          )}

          {/* Mentors Section */}
          {activeSection === 'mentors' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Mentors</h2>
                <button onClick={() => openModal('mentor')} className="btn-add">
                  ➕ Add Mentor
                </button>
              </div>

              <div className="cards-grid">
                {mentors.map(mentor => (
                  <div key={mentor.id} className="mentor-card">
                    <div className="mentor-avatar">{mentor.name?.charAt(0)}</div>
                    <h3>{mentor.name}</h3>
                    <p className="mentor-title">{mentor.title}</p>
                    <p className="mentor-company">{mentor.company} | {mentor.experience}</p>
                    <div className="mentor-skills">
                      {mentor.skills?.slice(0, 3).map((skill, idx) => (
                        <span key={idx} className="skill-tag">{skill}</span>
                      ))}
                    </div>
                    <div className="card-actions">
                      <button onClick={() => openModal('mentor', mentor)} className="btn-edit">✏️ Edit</button>
                      <button onClick={() => handleDelete(COLLECTIONS.MENTORS, mentor.id)} className="btn-delete">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {mentors.length === 0 && <p className="no-data">No mentors found. Add industry mentors!</p>}
            </div>
          )}

          {/* Classroom Videos Section */}
          {activeSection === 'classroom' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Classroom Videos</h2>
                <button onClick={() => openModal('classroom')} className="btn-add">
                  ➕ Add Video
                </button>
              </div>

              <div className="info-box">
                <p>📹 Add live class recordings from Zoom or Google Drive. Students can watch these videos in their Classroom section.</p>
                <p><strong>Zoom Recording:</strong> Open your recording in Zoom → Click "Share" → Copy the complete shareable link (includes passcode).</p>
                <p><strong>Google Drive:</strong> Upload video to Drive → Get shareable link → Copy the file ID from the URL.</p>
              </div>

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Topic</th>
                      <th>Instructor</th>
                      <th>Duration</th>
                      <th>Course</th>
                      <th>Video Source</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classroomVideos.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{textAlign: 'center', padding: '40px', color: '#888'}}>
                          No classroom videos added yet. Click "Add Video" to add your first recording.
                        </td>
                      </tr>
                    ) : (
                      classroomVideos
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map(video => (
                          <tr key={video.id}>
                            <td>{video.date}</td>
                            <td><strong>{video.title}</strong></td>
                            <td>
                              <span className="instructor-badge">{video.instructor}</span>
                            </td>
                            <td>{video.duration}</td>
                            <td>
                              <span className={`course-badge ${video.courseType?.includes('Cyber') ? 'cyber' : 'data'}`}>
                                {video.courseType || 'General'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <span className={`source-badge firebase`}>
                                  🔥 Firebase
                                </span>
                                <code className="drive-id">
                                  {video.firebaseStoragePath?.substring(0, 25)}...
                                </code>
                              </div>
                            </td>
                            <td>
                              <div className="action-btns">
                                <button onClick={() => openModal('classroom', video)} className="btn-edit" title="Edit">✏️</button>
                                <button onClick={() => handleDelete(COLLECTIONS.CLASSROOM, video.id)} className="btn-delete" title="Delete">🗑️</button>
                                <a 
                                  href="#"
                                  className="btn-view"
                                  title="View in player"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    // Create a simple video player modal
                                    const modal = document.createElement('div');
                                    modal.style.cssText = `
                                      position: fixed;
                                      top: 0;
                                      left: 0;
                                      width: 100vw;
                                      height: 100vh;
                                      background: rgba(0,0,0,0.9);
                                      z-index: 10000;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                    `;
                                    
                                    const content = document.createElement('div');
                                    content.style.cssText = `
                                      background: white;
                                      padding: 20px;
                                      border-radius: 8px;
                                      max-width: 500px;
                                      text-align: center;
                                    `;
                                    
                                    content.innerHTML = `
                                      <h3>🔥 Firebase Storage Video</h3>
                                      <p><strong>${video.title}</strong></p>
                                      <p>This video is stored in Firebase Storage and can be played by students in their Dashboard.</p>
                                      <p style="color: #666; font-size: 14px;">To preview: Go to Student Dashboard → Classroom → Select this video</p>
                                      <button style="
                                        background: #007bff;
                                        color: white;
                                        border: none;
                                        padding: 10px 20px;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        margin-top: 15px;
                                      " onclick="this.closest('div[style*=fixed]').remove()">Close</button>
                                    `;
                                    
                                    modal.appendChild(content);
                                    document.body.appendChild(modal);
                                    
                                    modal.addEventListener('click', (e) => {
                                      if (e.target === modal) {
                                        modal.remove();
                                      }
                                    });
                                  }}
                                >
                                  👁️
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Live Classes Section */}
          {activeSection === 'liveClasses' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Schedule Live Classes</h2>
                <div>
                  <button onClick={handleSyncRecordings} className="btn-sync" style={{marginRight: '10px'}}>
                    ☁️ Sync Zoom Recordings
                  </button>
                  <button onClick={() => openModal('liveClass')} className="btn-add">
                    ➕ Schedule Live Class
                  </button>
                </div>
              </div>

              <div className="info-box">
                <p>📡 Schedule live Zoom classes for your students. Zoom meetings are automatically created via API integration.</p>
                <p><strong>✨ Auto-Generated:</strong> No manual Zoom link needed! Just fill in the details and the system will create a unique Zoom meeting for each class.</p>
                <p><strong>☁️ Cloud Recordings:</strong> After classes end, click "Sync Zoom Recordings" to automatically fetch and add recordings to the Classroom section.</p>
              </div>

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Topic</th>
                      <th>Instructor</th>
                      <th>Duration</th>
                      <th>Course</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveClasses.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{textAlign: 'center', padding: '40px', color: '#888'}}>
                          No live classes scheduled yet. Click "Schedule Live Class" to add your first session.
                        </td>
                      </tr>
                    ) : (
                      liveClasses
                        .sort((a, b) => new Date(a.scheduledDate + ' ' + a.scheduledTime) - new Date(b.scheduledDate + ' ' + b.scheduledTime))
                        .map(liveClass => {
                          const classDateTime = new Date(liveClass.scheduledDate + ' ' + liveClass.scheduledTime);
                          const isUpcoming = classDateTime > new Date();
                          const isPast = classDateTime < new Date();
                          
                          return (
                            <tr key={liveClass.id}>
                              <td>
                                <strong>{liveClass.scheduledDate}</strong>
                                <br />
                                <span style={{fontSize: '0.85em', color: '#666'}}>{liveClass.scheduledTime}</span>
                              </td>
                              <td><strong>{liveClass.title}</strong></td>
                              <td>
                                <span className="instructor-badge">{liveClass.instructor}</span>
                              </td>
                              <td>{liveClass.duration}</td>
                              <td>
                                <span className={`course-badge ${liveClass.course?.includes('Cyber') ? 'cyber' : 'data'}`}>
                                  {liveClass.course}
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${isPast ? 'completed' : isUpcoming ? 'active' : ''}`}>
                                  {isPast ? '✅ Completed' : '🔴 Live'}
                                </span>
                              </td>
                              <td>
                                <div className="action-btns">
                                  <button onClick={() => openModal('liveClass', liveClass)} className="btn-edit" title="Edit">✏️</button>
                                  <button onClick={() => handleDelete(COLLECTIONS.LIVE_CLASSES, liveClass.id)} className="btn-delete" title="Delete">🗑️</button>
                                  <a 
                                    href={liveClass.zoomLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="btn-view"
                                    title="Join Zoom"
                                  >
                                    📡
                                  </a>
                                </div>
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

          {/* Content Section */}
          {activeSection === 'content' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Content & Announcements</h2>
                <button onClick={() => openModal('content')} className="btn-add">
                  ➕ Add Content
                </button>
              </div>

              <div className="content-management">
                <p>Manage announcements, supplementary courses, and featured content displayed to students.</p>
                <div className="content-actions-grid">
                  <button className="action-card" onClick={() => openModal('content')}>
                    <span className="icon">📢</span>
                    <h4>Post Announcement</h4>
                    <p>Notify all students</p>
                  </button>
                  <button className="action-card">
                    <span className="icon">📚</span>
                    <h4>Add Supplementary Course</h4>
                    <p>Extra learning materials</p>
                  </button>
                  <button className="action-card">
                    <span className="icon">⭐</span>
                    <h4>Feature Content</h4>
                    <p>Highlight on dashboard</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Section */}
          {activeSection === 'analytics' && (
            <div className="admin-section">
              <h2>Analytics & Reports</h2>
              
              <div className="analytics-summary">
                <div className="summary-card">
                  <div className="summary-icon" style={{background: '#e3f2fd'}}>📊</div>
                  <div className="summary-content">
                    <h4>Total Students</h4>
                    <p className="summary-number">{students.length}</p>
                    <span className="summary-change positive">+12% this month</span>
                  </div>
                </div>
                
                <div className="summary-card">
                  <div className="summary-icon" style={{background: '#f3e5f5'}}>📚</div>
                  <div className="summary-content">
                    <h4>Active Courses</h4>
                    <p className="summary-number">{courses.length}</p>
                    <span className="summary-change neutral">{modules.length} modules</span>
                  </div>
                </div>
                
                <div className="summary-card">
                  <div className="summary-icon" style={{background: '#e8f5e9'}}>💼</div>
                  <div className="summary-content">
                    <h4>Job Opportunities</h4>
                    <p className="summary-number">{jobs.filter(j => j.status === 'active').length}</p>
                    <span className="summary-change positive">+5 new jobs</span>
                  </div>
                </div>
                
                <div className="summary-card">
                  <div className="summary-icon" style={{background: '#fff3e0'}}>🎯</div>
                  <div className="summary-content">
                    <h4>Completion Rate</h4>
                    <p className="summary-number">87%</p>
                    <span className="summary-change positive">+3% from last month</span>
                  </div>
                </div>
              </div>

              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>📈 Student Enrollment Trend</h3>
                  <div className="bar-chart">
                    <div className="chart-bars">
                      <div className="bar-group">
                        <div className="bar" style={{height: '60%'}}></div>
                        <span className="bar-label">Jan</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '75%'}}></div>
                        <span className="bar-label">Feb</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '85%'}}></div>
                        <span className="bar-label">Mar</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '70%'}}></div>
                        <span className="bar-label">Apr</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '90%'}}></div>
                        <span className="bar-label">May</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '100%'}}></div>
                        <span className="bar-label">Jun</span>
                      </div>
                    </div>
                    <div className="chart-stats">
                      <p>Total Enrollments: <strong>{students.length}</strong></p>
                      <p>Average per Month: <strong>{Math.round(students.length / 6)}</strong></p>
                    </div>
                  </div>
                </div>
                
                <div className="analytics-card">
                  <h3>📚 Course Distribution</h3>
                  <div className="progress-list">
                    {courses.slice(0, 5).map((course, idx) => (
                      <div key={course.id} className="progress-item">
                        <div className="progress-info">
                          <span className="progress-name">{course.title || `Course ${idx + 1}`}</span>
                          <span className="progress-value">{Math.round(Math.random() * 40 + 60)}%</span>
                        </div>
                        <div className="progress-bar-analytics">
                          <div className="progress-fill-analytics" style={{width: `${Math.round(Math.random() * 40 + 60)}%`}}></div>
                        </div>
                      </div>
                    ))}
                    {courses.length === 0 && <p className="no-data">No courses available</p>}
                  </div>
                </div>
                
                <div className="analytics-card">
                  <h3>💼 Job Placement Stats</h3>
                  <div className="pie-chart-wrapper">
                    <div className="pie-chart">
                      <div className="pie-segment" style={{
                        background: `conic-gradient(
                          #667eea 0deg 252deg,
                          #48bb78 252deg 324deg,
                          #f59e0b 324deg 360deg
                        )`
                      }}></div>
                      <div className="pie-center">
                        <div className="pie-percentage">87%</div>
                        <div className="pie-label">Placed</div>
                      </div>
                    </div>
                    <div className="pie-legend">
                      <div className="legend-item">
                        <span className="legend-color" style={{background: '#667eea'}}></span>
                        <span>Placed (70%)</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-color" style={{background: '#48bb78'}}></span>
                        <span>Interviewing (20%)</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-color" style={{background: '#f59e0b'}}></span>
                        <span>Searching (10%)</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="analytics-card">
                  <h3>👥 User Engagement</h3>
                  <div className="line-chart">
                    <div className="chart-area">
                      <svg viewBox="0 0 300 150" className="line-svg">
                        <polyline
                          points="0,120 50,100 100,80 150,90 200,60 250,40 300,30"
                          fill="none"
                          stroke="#667eea"
                          strokeWidth="3"
                        />
                        <polyline
                          points="0,120 50,100 100,80 150,90 200,60 250,40 300,30"
                          fill="url(#gradient)"
                          opacity="0.2"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#667eea" />
                            <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <div className="chart-stats">
                      <p>Daily Active Users: <strong>245</strong></p>
                      <p>Peak Hours: <strong>2PM - 6PM</strong></p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="reports-section">
                <h3>📄 Generate Reports</h3>
                <div className="report-buttons">
                  <button className="btn-report" onClick={() => showToast('Generating Student Progress Report...', 'info')}>
                    <span className="report-icon">📊</span>
                    <span className="report-text">
                      <strong>Student Progress Report</strong>
                      <small>Detailed progress of all students</small>
                    </span>
                  </button>
                  <button className="btn-report" onClick={() => showToast('Generating Course Completion Report...', 'info')}>
                    <span className="report-icon">✅</span>
                    <span className="report-text">
                      <strong>Course Completion Report</strong>
                      <small>Completion rates and analytics</small>
                    </span>
                  </button>
                  <button className="btn-report" onClick={() => showToast('Generating Revenue Report...', 'info')}>
                    <span className="report-icon">💰</span>
                    <span className="report-text">
                      <strong>Revenue Report</strong>
                      <small>Financial summary and trends</small>
                    </span>
                  </button>
                  <button className="btn-report" onClick={() => showToast('Generating Monthly Analytics...', 'info')}>
                    <span className="report-icon">📈</span>
                    <span className="report-text">
                      <strong>Monthly Analytics</strong>
                      <small>Comprehensive monthly overview</small>
                    </span>
                  </button>
                </div>
              </div>

              <div className="insights-section">
                <h3>💡 Key Insights</h3>
                <div className="insights-grid">
                  <div className="insight-card">
                    <span className="insight-icon">🎯</span>
                    <p>Top performing course: <strong>Cyber Security & Ethical Hacking</strong></p>
                  </div>
                  <div className="insight-card">
                    <span className="insight-icon">⏰</span>
                    <p>Average completion time: <strong>4.5 months</strong></p>
                  </div>
                  <div className="insight-card">
                    <span className="insight-icon">🌟</span>
                    <p>Student satisfaction rate: <strong>94%</strong></p>
                  </div>
                  <div className="insight-card">
                    <span className="insight-icon">📚</span>
                    <p>Most popular module: <strong>Penetration Testing</strong></p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} key={`${modalType}-${editingItem ? 'edit' : 'new'}-${Date.now()}`}>
            <div className="modal-header">
              <h2>{editingItem ? 'Edit' : 'Add'} {modalType.charAt(0).toUpperCase() + modalType.slice(1)}</h2>
              <button className="close-btn" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-content">
              {modalType === 'student' && (
                <>
                  {editingItem && editingItem.lastLogin && (
                    <div className="ip-info-display">
                      <h4>📍 Last Login Information</h4>
                      <div className="ip-details">
                        <p><strong>IP Address:</strong> {editingItem.lastLogin.ipAddress || editingItem.lastLoginIP || 'N/A'}</p>
                        <p><strong>Location:</strong> {editingItem.lastLogin.city}, {editingItem.lastLogin.country}</p>
                        <p><strong>ISP:</strong> {editingItem.lastLogin.isp || 'Unknown'}</p>
                        <p><strong>Time:</strong> {editingItem.lastLogin.timestamp ? new Date(editingItem.lastLogin.timestamp).toLocaleString() : 'N/A'}</p>
                      </div>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Student full name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Enter student email address *"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    autoComplete="off"
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    onBlur={(e) => e.target.setAttribute('readonly', true)}
                  />
                  {!editingItem && (
                    <input
                      type="password"
                      placeholder="Create password for student *"
                      value={formData.password || ''}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      onBlur={(e) => e.target.setAttribute('readonly', true)}
                    />
                  )}
                  <input
                    type="text"
                    placeholder="Enrollment Number *"
                    value={formData.enrollmentNumber || ''}
                    onChange={(e) => handleInputChange('enrollmentNumber', e.target.value)}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                  <textarea
                    placeholder="Address"
                    value={formData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows="2"
                  />
                  <select
                    value={formData.course || ''}
                    onChange={(e) => handleInputChange('course', e.target.value)}
                    required
                  >
                    <option value="">Select Course *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="graduated">Graduated</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </>
              )}

              {modalType === 'teacher' && (
                <>
                  <input
                    type="text"
                    placeholder="Teacher full name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Enter teacher email address *"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    autoComplete="off"
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    onBlur={(e) => e.target.setAttribute('readonly', true)}
                  />
                  {!editingItem && (
                    <input
                      type="password"
                      placeholder="Create password for teacher *"
                      value={formData.password || ''}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      onBlur={(e) => e.target.setAttribute('readonly', true)}
                    />
                  )}
                  <input
                    type="number"
                    placeholder="Age"
                    value={formData.age || ''}
                    onChange={(e) => handleInputChange('age', parseInt(e.target.value) || '')}
                    min="18"
                    max="80"
                  />
                  <select
                    value={formData.domain || ''}
                    onChange={(e) => handleInputChange('domain', e.target.value)}
                    required
                  >
                    <option value="">Select Domain *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Experience (e.g., 5 years, 3+ years in teaching)"
                    value={formData.experience || ''}
                    onChange={(e) => handleInputChange('experience', e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                  <textarea
                    placeholder="Address"
                    value={formData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows="2"
                  />
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on-leave">On Leave</option>
                  </select>
                </>
              )}

              {modalType === 'course' && (
                <>
                  <input
                    type="text"
                    placeholder="Course Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Description *"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="4"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Instructor Name"
                    value={formData.instructor || ''}
                    onChange={(e) => handleInputChange('instructor', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., 6 months)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Number of Modules"
                    value={formData.modules || ''}
                    onChange={(e) => handleInputChange('modules', parseInt(e.target.value) || 0)}
                  />
                  <input
                    type="text"
                    placeholder="Price (e.g., $999 or Free)"
                    value={formData.price || ''}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                  />
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="coming-soon">Coming Soon</option>
                  </select>
                </>
              )}

              {modalType === 'module' && (
                <>
                  <input
                    type="text"
                    placeholder="Module Name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                  <select
                    value={formData.courseId || ''}
                    onChange={(e) => handleInputChange('courseId', e.target.value)}
                    required
                  >
                    <option value="">Select Course *</option>
                    <option value="1">Data Science & AI</option>
                    <option value="2">Cyber Security & Ethical Hacking</option>
                  </select>
                  <textarea
                    placeholder="Module Description"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="3"
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., 4 weeks)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Number of Lessons"
                    value={formData.lessons || ''}
                    onChange={(e) => handleInputChange('lessons', parseInt(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    placeholder="Order / Sequence"
                    value={formData.order || ''}
                    onChange={(e) => handleInputChange('order', parseInt(e.target.value) || 1)}
                  />
                </>
              )}

              {modalType === 'lesson' && (
                <>
                  <input
                    type="text"
                    placeholder="Lesson Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <select
                    value={formData.moduleId || ''}
                    onChange={(e) => handleInputChange('moduleId', e.target.value)}
                    required
                  >
                    <option value="">Select Module *</option>
                    {modules.map(module => {
                      const courseName = module.courseId === '1' ? 'Data Science & AI' : 
                                       module.courseId === '2' ? 'Cyber Security & Ethical Hacking' : '';
                      return (
                        <option key={module.id} value={module.id}>
                          {module.name} {courseName ? `(${courseName})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <textarea
                    placeholder="Lesson Content *"
                    value={formData.content || ''}
                    onChange={(e) => handleInputChange('content', e.target.value)}
                    rows="5"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., 45 min)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="url"
                    placeholder="Video URL (YouTube, Vimeo, etc.)"
                    value={formData.videoUrl || ''}
                    onChange={(e) => handleInputChange('videoUrl', e.target.value)}
                  />
                  <input
                    type="url"
                    placeholder="Class Link (Zoom / Google Meet)"
                    value={formData.classLink || ''}
                    onChange={(e) => handleInputChange('classLink', e.target.value)}
                  />
                  <textarea
                    placeholder="Additional Resources (links, PDFs, etc.)"
                    value={formData.resources || ''}
                    onChange={(e) => handleInputChange('resources', e.target.value)}
                    rows="2"
                  />
                  <input
                    type="number"
                    placeholder="Order / Sequence"
                    value={formData.order || ''}
                    onChange={(e) => handleInputChange('order', parseInt(e.target.value) || 1)}
                  />
                </>
              )}

              {modalType === 'project' && (
                <>
                  <input
                    type="text"
                    placeholder="Project Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Project Description *"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="4"
                    required
                  />
                  <textarea
                    placeholder="Requirements"
                    value={formData.requirements || ''}
                    onChange={(e) => handleInputChange('requirements', e.target.value)}
                    rows="3"
                  />
                  <textarea
                    placeholder="Deliverables"
                    value={formData.deliverables || ''}
                    onChange={(e) => handleInputChange('deliverables', e.target.value)}
                    rows="3"
                  />
                  <select
                    value={formData.difficulty || 'Intermediate'}
                    onChange={(e) => handleInputChange('difficulty', e.target.value)}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Duration (e.g., 3 weeks)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Skills Required (comma-separated)"
                    value={formData.skills?.join(', ') || ''}
                    onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                  />
                </>
              )}

              {modalType === 'assessment' && (
                <>
                  <input
                    type="text"
                    placeholder="Assessment Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Description"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="3"
                  />
                  <input
                    type="number"
                    placeholder="Number of Questions"
                    value={formData.questions || ''}
                    onChange={(e) => handleInputChange('questions', parseInt(e.target.value) || 0)}
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., 90 min)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Passing Score (%)"
                    value={formData.passingScore || 70}
                    onChange={(e) => handleInputChange('passingScore', parseInt(e.target.value) || 70)}
                    min="0"
                    max="100"
                  />
                  <select
                    value={formData.difficulty || 'Medium'}
                    onChange={(e) => handleInputChange('difficulty', e.target.value)}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </>
              )}

              {modalType === 'job' && (
                <>
                  <input
                    type="text"
                    placeholder="Job Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Company *"
                    value={formData.company || ''}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Job Description"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="3"
                  />
                  <input
                    type="text"
                    placeholder="Location (e.g., Remote, New York, Hybrid)"
                    value={formData.location || ''}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Salary Range (e.g., $95K - $130K)"
                    value={formData.salary || ''}
                    onChange={(e) => handleInputChange('salary', e.target.value)}
                  />
                  <select
                    value={formData.type || 'Full-time'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="filled">Filled</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Required Skills (comma-separated)"
                    value={formData.skills?.join(', ') || ''}
                    onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                  />
                </>
              )}

              {modalType === 'mentor' && (
                <>
                  <input
                    type="text"
                    placeholder="Mentor full name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Job Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Company *"
                    value={formData.company || ''}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Enter mentor email address *"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    autoComplete="off"
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    onBlur={(e) => e.target.setAttribute('readonly', true)}
                  />
                  {!editingItem && (
                    <input
                      type="password"
                      placeholder="Create password for mentor *"
                      value={formData.password || ''}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      onBlur={(e) => e.target.setAttribute('readonly', true)}
                    />
                  )}
                  <select
                    value={formData.domain}
                    onChange={(e) => handleInputChange('domain', e.target.value)}
                    required
                  >
                    <option value="">Select Domain *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <input
                    type="url"
                    placeholder="LinkedIn Profile URL"
                    value={formData.linkedin || ''}
                    onChange={(e) => handleInputChange('linkedin', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Experience (e.g., 10 years exp)"
                    value={formData.experience || ''}
                    onChange={(e) => handleInputChange('experience', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Skills (comma-separated)"
                    value={formData.skills?.join(', ') || ''}
                    onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                  />
                  <textarea
                    placeholder="Bio / About"
                    value={formData.bio || ''}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    rows="4"
                  />
                </>
              )}

              {modalType === 'classroom' && (
                <>
                  <input
                    type="text"
                    placeholder="Video Title / Topic Name *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Instructor Name *"
                    value={formData.instructor || ''}
                    onChange={(e) => handleInputChange('instructor', e.target.value)}
                    required
                  />
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Video Source *</label>
                    <select
                      value={formData.videoSource || 'firebase'}
                      onChange={(e) => handleInputChange('videoSource', e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                      <option value="firebase">Firebase Storage</option>
                      <option value="youtube">YouTube Private Upload</option>
                      <option value="youtube-url">Manual YouTube URL</option>
                    </select>
                  </div>
                  
                  {/* Video Input Form - Dynamic based on source */}
                  {formData.videoSource === 'youtube-url' ? (
                    // Manual YouTube URL Input
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        YouTube Video URL *
                      </label>
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={formData.youtubeUrl || ''}
                        onChange={(e) => handleInputChange('youtubeUrl', e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                      <small style={{color: '#888', marginTop: '-10px', display: 'block'}}>
                        Paste the YouTube video URL. Video should be uploaded as "Private" or "Unlisted" on YouTube.
                      </small>
                      <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
                        <strong>📺 Manual YouTube URL:</strong><br/>
                        • Upload video to YouTube as Private/Unlisted first<br/>
                        • Copy the YouTube video URL here<br/>
                        • Students will only see videos for their enrolled course<br/>
                        • No API configuration needed
                      </div>
                    </div>
                  ) : (
                    // File Upload for Firebase and YouTube Upload
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Upload Video File *
                      </label>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleInputChange('videoFile', e.target.files[0])}
                        required
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                      <small style={{color: '#888', marginTop: '-10px', display: 'block'}}>
                        {formData.videoSource === 'youtube' 
                          ? 'Select a video file to upload to YouTube as private. Max size: 2GB.'
                          : 'Select a video file (MP4, MOV, AVI, etc.). Max size: 2GB.'
                        }
                      </small>
                      {formData.videoSource === 'youtube' && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px', border: '1px solid #2196f3' }}>
                          <strong>📺 YouTube Upload:</strong><br/>
                          • Video will be uploaded as <strong>Private</strong><br/>
                          • Only accessible with the embed URL<br/>
                          • Requires YouTube API configuration<br/>
                          • Processing may take a few minutes
                        </div>
                      )}
                    </div>
                  )}
                  
                  <input
                    type="text"
                    placeholder="Course ID *"
                    value={formData.courseId || ''}
                    onChange={(e) => handleInputChange('courseId', e.target.value)}
                    required
                    style={{ marginBottom: '15px' }}
                  />
                  <small style={{color: '#888', marginTop: '-10px', display: 'block'}}>
                    Enter the course identifier (e.g., data-science-101, cyber-security-001)
                  </small>
                  
                  <textarea
                    placeholder="Video Description (optional)"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    style={{resize: 'vertical', minHeight: '60px', marginBottom: '15px'}}
                  />
                  
                  <input
                    type="text"
                    placeholder="Batch ID (optional)"
                    value={formData.batchId || ''}
                    onChange={(e) => handleInputChange('batchId', e.target.value)}
                    style={{ marginBottom: '15px' }}
                  />
                  
                  <input
                    type="text"
                    placeholder="Domain (optional)"
                    value={formData.domain || ''}
                    onChange={(e) => handleInputChange('domain', e.target.value)}
                    style={{ marginBottom: '15px' }}
                  />
                  
                  <input
                    type="text"
                    placeholder="Video Duration (e.g., 1 hr 45 min)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="date"
                    placeholder="Session Date"
                    value={formData.date || ''}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                  />
                  <select
                    value={formData.courseType || 'Data Science & AI'}
                    onChange={(e) => handleInputChange('courseType', e.target.value)}
                  >
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <select
                    value={formData.type || 'Live Class'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  >
                    <option value="Live Class">Live Class</option>
                    <option value="Lecture">Lecture</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Q&A Session">Q&A Session</option>
                    <option value="Demo">Demo</option>
                    <option value="Review Session">Review Session</option>
                  </select>
                </>
              )}

              {modalType === 'liveClass' && (
                <>
                  <input
                    type="text"
                    placeholder="Class Title / Topic *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <select
                    value={formData.course || 'Data Science & AI'}
                    onChange={(e) => handleInputChange('course', e.target.value)}
                  >
                    <option value="">Select Course *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <input
                    type="date"
                    placeholder="Scheduled Date *"
                    value={formData.scheduledDate || ''}
                    onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                    required
                  />
                  <input
                    type="time"
                    placeholder="Scheduled Time *"
                    value={formData.scheduledTime || ''}
                    onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                    required
                  />
                  <select
                    value={formData.duration || '60 mins'}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  >
                    <option value="30 mins">30 mins</option>
                    <option value="45 mins">45 mins</option>
                    <option value="60 mins">60 mins</option>
                    <option value="90 mins">90 mins</option>
                    <option value="120 mins">2 hours</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Instructor Name"
                    value={formData.instructor || ''}
                    onChange={(e) => handleInputChange('instructor', e.target.value)}
                  />
                  <textarea
                    placeholder="Description / Agenda (optional)"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="3"
                  />
                  <small style={{color: '#28a745', marginTop: '-10px', display: 'block', fontWeight: 'bold'}}>
                    ✅ Zoom meeting link will be auto-generated when you save
                  </small>
                </>
              )}

              {modalType === 'content' && (
                <>
                  <select
                    value={formData.type || 'announcement'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  >
                    <option value="announcement">Announcement</option>
                    <option value="feature">Featured Content</option>
                    <option value="supplementary">Supplementary Course</option>
                    <option value="news">News Update</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Content *"
                    value={formData.content || ''}
                    onChange={(e) => handleInputChange('content', e.target.value)}
                    rows="5"
                    required
                  />
                  <select
                    value={formData.targetAudience || 'all'}
                    onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                  >
                    <option value="all">All Students</option>
                    <option value="active">Active Students</option>
                    <option value="new">New Students</option>
                    <option value="graduated">Graduated Students</option>
                  </select>
                  <select
                    value={formData.priority || 'normal'}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                  >
                    <option value="low">Low Priority</option>
                    <option value="normal">Normal Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={handleSave} className="btn-save" disabled={saving}>
                {saving ? (editingItem ? 'Updating...' : 'Creating...') : (editingItem ? 'Update' : 'Create')}
              </button>
              <button onClick={closeModal} className="btn-cancel" disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default AdminDashboard;
