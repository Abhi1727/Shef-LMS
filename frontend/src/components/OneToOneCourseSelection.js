import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { oneToOneBatchService } from '../services/oneToOneBatchService';
import { showToast } from './Toast';
import OneToOneCourseSelectionFallback from './OneToOneCourseSelectionFallback';
import './OneToOneCourseSelection.css';

const OneToOneCourseSelection = () => {
  const navigate = useNavigate();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [apiError, setApiError] = useState(null);
  
  // State for student assignment modal
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [selectedBatchForStudent, setSelectedBatchForStudent] = useState(null);
  
  // Student-related state (moved here for student assignment modal)
  const [students, setStudents] = useState([]);
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const courses = [
    {
      id: 'Data Science & AI',
      title: 'Data Science & AI',
      description: 'Master data science, machine learning, and artificial intelligence with personalized one-to-one instruction.',
      icon: '🤖',
      color: '#6366f1'
    },
    {
      id: 'Cyber Security & Ethical Hacking',
      title: 'Cyber Security & Ethical Hacking',
      description: 'Learn cybersecurity fundamentals, ethical hacking, and security best practices with dedicated mentorship.',
      icon: '🔒',
      color: '#10b981'
    }
  ];

  useEffect(() => {
    if (selectedCourse) {
      loadBatches();
    }
  }, [selectedCourse]);

  const loadBatches = async () => {
    setLoading(true);
    setApiError(null);
    try {
      console.log('Loading batches for course:', selectedCourse);
      
      // Check if service is available
      if (!oneToOneBatchService) {
        console.error('oneToOneBatchService not available');
        setApiError('Service not available');
        setUseFallback(true);
        setBatches([]);
        setLoading(false);
        return;
      }
      
      const response = await oneToOneBatchService.getBatchesByCourse(selectedCourse);
      console.log('Batches response:', response);
      
      if (response && response.success) {
        setBatches(response.batches || []);
        console.log('Batches loaded:', response.batches);
      } else {
        console.error('Failed to load batches:', response);
        setApiError('Failed to load batches');
        setUseFallback(true);
        setBatches([]); // Set empty array on failure
      }
    } catch (error) {
      console.error('Error loading batches:', error);
      setApiError(error.message);
      setUseFallback(true);
      showToast('Error loading batches - switching to fallback mode', 'warning');
      setBatches([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleCourseSelect = (courseId) => {
    setSelectedCourse(courseId);
    setBatches([]);
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setBatches([]);
  };

  const handleBatchClick = (batch) => {
    // Navigate to the dedicated batch management page
    navigate(`/admin/one-to-one-batch/${batch.id}`);
  };

  const handleAddBatch = () => {
    setShowAddModal(true);
  };

  const handleBatchCreated = (newBatch) => {
    setBatches(prev => [...prev, newBatch]);
    setShowAddModal(false);
    showToast('One-to-one batch created successfully', 'success');
  };

  // If API errors occurred, show fallback component
  if (useFallback || apiError) {
    return <OneToOneCourseSelectionFallback />;
  }

  const handleAssignStudentToBatch = async () => {
    if (!selectedStudent || !selectedBatchForStudent) return;
    
    setAssignmentLoading(true);
    try {
      const response = await oneToOneBatchService.updateStudent(selectedBatchForStudent.id, {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentEmail: selectedStudent.email
      });
      
      if (response.success) {
        showToast('Student assigned successfully', 'success');
        
        // Update the batch in the batches list
        setBatches(prev => prev.map(batch => 
          batch.id === selectedBatchForStudent.id 
            ? { ...batch, studentId: selectedStudent.id, studentName: selectedStudent.name, studentEmail: selectedStudent.email }
            : batch
        ));
        
        // Close modal and reset state
        setShowStudentModal(false);
        setSelectedStudent(null);
        setSearchStudent('');
        setSelectedBatchForStudent(null);
      } else {
        showToast('Failed to assign student', 'error');
      }
    } catch (error) {
      console.error('Error assigning student:', error);
      showToast('Error assigning student', 'error');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSearchStudent('');
  };

  const loadStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      console.log('Loading students... selectedCourse:', selectedCourse);
      
      if (!token) {
        console.error('No auth token found for students');
        showToast('Please login to load students', 'error');
        return;
      }
      
      // Load students
      const studentsResponse = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Students API response status:', studentsResponse.status);
      
      if (studentsResponse.ok) {
        const allStudentsData = await studentsResponse.json();
        const allStudents = allStudentsData || [];
        console.log('All students data received:', allStudents.length, 'students');
        
        // Filter students by selected course (same logic as BatchDetailsPage)
        const course = courses.find(c => c.id === selectedCourse);
        console.log('Found course:', course);
        
        const filteredStudents = allStudents.filter(student => {
          // Only show students whose course matches selected course
          if (course?.id) {
            const courseLower = course.id.toLowerCase();
            const studentCourseLower = (student.course || '').toLowerCase();
            
            console.log('Comparing:', courseLower, 'with', studentCourseLower);
            
            // Handle different course name variations
            const isCyberSecurityCourse = courseLower.includes('cyber') || courseLower.includes('security') || courseLower.includes('cs&eh');
            const studentIsCyberSecurityCourse = studentCourseLower.includes('cyber') || studentCourseLower.includes('security') || studentCourseLower.includes('cs&eh');
            
            const isDataScienceCourse = courseLower.includes('data') || courseLower.includes('science') || courseLower.includes('ai');
            const studentIsDataScienceCourse = studentCourseLower.includes('data') || studentCourseLower.includes('science') || studentCourseLower.includes('ai');
            
            const courseMatches = ((isCyberSecurityCourse && studentIsCyberSecurityCourse) || 
                  (isDataScienceCourse && studentIsDataScienceCourse) ||
                  courseLower === studentCourseLower);
            
            if (!courseMatches) {
              console.log('Student', student.email, 'filtered out - course mismatch');
              return false;
            }
          }
          
          // Only show students who don't have a batch assigned (batchId is null, undefined, or empty)
          if (student.batchId) {
            console.log('Student', student.email, 'filtered out - already has batchId:', student.batchId);
            return false;
          }
          
          // Additional check for valid batch assignment
          const hasValidBatch = student.batchId && 
            String(student.batchId).trim() !== '' && 
            String(student.batchId).trim() !== 'null' && 
            String(student.batchId).trim() !== 'undefined';
          
          if (hasValidBatch) {
            console.log('Student', student.email, 'filtered out - has valid batch assignment');
            return false;
          }
          
          console.log('Student', student.email, 'included - unassigned and correct course');
          return true;
        });
        
        console.log(`Filtered ${filteredStudents.length} unassigned students for course: ${course?.title}`);
        setStudents(filteredStudents);
      } else {
        const errorText = await studentsResponse.text();
        console.error('Students API error:', studentsResponse.status, errorText);
        
        if (studentsResponse.status === 401) {
          showToast('Session expired. Please login again.', 'error');
        } else if (studentsResponse.status === 403) {
          showToast('Access denied. Admin privileges required.', 'error');
        } else {
          showToast('Failed to load students from server. Please re-login and try again.', 'error');
        }
      }
    } catch (error) {
      console.error('Error loading students:', error);
      showToast('Network error. Please check your connection.', 'error');
    }
  };

  if (selectedCourse) {
    const course = courses.find(c => c.id === selectedCourse);
    
    return (
      <div className="one-to-one-course-view">
        <div className="course-header">
          <button className="back-btn" onClick={handleBackToCourses}>
            ← Back to Courses
          </button>
          <div className="course-info">
            <span className="course-icon">{course.icon}</span>
            <h2>{course.title}</h2>
          </div>
          <button className="add-batch-btn" onClick={handleAddBatch}>
            ➕ Create New Batch
          </button>
        </div>

        <div className="batches-container">
          {loading ? (
            <div className="loading-state">Loading batches...</div>
          ) : batches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📚</div>
              <h3>No One-to-One Batches Yet</h3>
              <p>Start by creating your first one-to-one batch for {course.title}</p>
              <button className="create-first-batch-btn" onClick={handleAddBatch}>
                Create First Batch
              </button>
            </div>
          ) : (
            <div className="batches-grid">
              {batches.map(batch => (
                <div 
                  key={batch.id} 
                  className="batch-card"
                  onClick={() => handleBatchClick(batch)}
                >
                  <div className="batch-header">
                    <h3>{batch.name}</h3>
                    <span className={`batch-status ${batch.status}`}>
                      {batch.status}
                    </span>
                  </div>
                  
                  <div className="batch-student">
                    <strong>Student:</strong> {batch.studentName}
                    <br />
                    <small>{batch.studentEmail}</small>
                  </div>
                  
                  <div className="batch-teacher">
                    <strong>Teacher:</strong> {batch.teacherName || batch.teacherId}
                  </div>
                  
                  <div className="batch-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${batch.progress || 0}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">{batch.progress || 0}% Complete</span>
                  </div>
                  
                  <div className="batch-meta">
                    <span className="video-count">
                      📹 {batch.videos?.length || 0} videos
                    </span>
                    {batch.startDate && (
                      <span className="start-date">
                        📅 Started: {new Date(batch.startDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showAddModal && (
          <AddOneToOneBatchModal
            course={course}
            onClose={() => setShowAddModal(false)}
            onBatchCreated={handleBatchCreated}
            students={students}
            setStudents={setStudents}
            searchStudent={searchStudent}
            setSearchStudent={setSearchStudent}
            selectedStudent={selectedStudent}
            setSelectedStudent={setSelectedStudent}
            handleStudentSelect={handleStudentSelect}
            loadStudents={loadStudents}
            setSelectedBatchForStudent={setSelectedBatchForStudent}
            setShowStudentModal={setShowStudentModal}
            selectedBatchForStudent={selectedBatchForStudent}
            setBatches={setBatches}
            assignmentLoading={assignmentLoading}
            setAssignmentLoading={setAssignmentLoading}
          />
        )}

        {showStudentModal && selectedBatchForStudent && (
          <div className="modal-overlay">
            <div className="modal-content student-assignment-modal">
              <div className="modal-header">
                <h3>Assign Student to Batch</h3>
                <button className="close-btn" onClick={() => setShowStudentModal(false)}>×</button>
              </div>

              <div className="batch-info">
                <h4>Batch: {selectedBatchForStudent.name}</h4>
                <p><strong>Course:</strong> {selectedBatchForStudent.courseTitle || course.title}</p>
                <p><strong>Teacher:</strong> {selectedBatchForStudent.teacherName}</p>
              </div>

              <div className="form-group">
                <label>Search Student *</label>
                <input
                  type="text"
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  placeholder="Search student by name or email..."
                />
                {searchStudent && students.filter(student =>
                  student.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                  student.email.toLowerCase().includes(searchStudent.toLowerCase())
                ).length > 0 && (
                  <div className="student-search-results">
                    {students.filter(student =>
                      student.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                      student.email.toLowerCase().includes(searchStudent.toLowerCase())
                    ).map(student => (
                      <div
                        key={student.id}
                        className="student-option"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <strong>{student.name}</strong>
                        <br />
                        <small>{student.email}</small>
                        <br />
                        <span className="student-course">📚 {student.course}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!searchStudent && students.length > 0 && (
                  <div className="student-search-results">
                    <div className="student-search-info">
                      📋 Showing {students.length} unassigned students for <strong>{course.title}</strong>
                    </div>
                    {students.slice(0, 5).map(student => (
                      <div
                        key={student.id}
                        className="student-option"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <strong>{student.name}</strong>
                        <br />
                        <small>{student.email}</small>
                        <br />
                        <span className="student-course">📚 {student.course}</span>
                      </div>
                    ))}
                    {students.length > 5 && (
                      <div className="student-more-info">
                        ... and {students.length - 5} more students (use search to find specific students)
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedStudent && (
                <div className="selected-student">
                  <strong>Selected Student:</strong> {selectedStudent.name} ({selectedStudent.email})
                </div>
              )}

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-skip" 
                  onClick={() => {
                    showToast('Student assignment skipped. You can assign student later.', 'info');
                    setShowStudentModal(false);
                    setSelectedStudent(null);
                    setSearchStudent('');
                  }}
                >
                  Skip for Now
                </button>
                <button 
                  type="button" 
                  className="btn-submit" 
                  onClick={handleAssignStudentToBatch}
                  disabled={!selectedStudent}
                >
                  Assign Student
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="one-to-one-course-selection">
      <div className="selection-header">
        <h2>Select Course for One-to-One Batches</h2>
        <p>Choose a course to manage private one-to-one batches for individual students</p>
      </div>
      
      <div className="courses-grid">
        {courses.map(course => (
          <div 
            key={course.id}
            className="course-card"
            onClick={() => handleCourseSelect(course.id)}
            style={{ borderColor: course.color }}
          >
            <div className="course-icon" style={{ backgroundColor: course.color }}>
              {course.icon}
            </div>
            <h3>{course.title}</h3>
            <p>{course.description}</p>
            <div className="course-action">
              <span>Manage Batches →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Add OneToOneBatchModal component (will be created separately)
const AddOneToOneBatchModal = ({ 
  course, 
  onClose, 
  onBatchCreated,
  students,
  setStudents,
  searchStudent,
  setSearchStudent,
  selectedStudent,
  setSelectedStudent,
  handleStudentSelect,
  loadStudents,
  setSelectedBatchForStudent,
  setShowStudentModal,
  selectedBatchForStudent,
  setBatches,
  assignmentLoading,
  setAssignmentLoading
}) => {
  const [formData, setFormData] = useState({
    name: '',
    teacherId: '',
    teacherName: '',
    startDate: '',
    endDate: '',
    schedule: { days: [], time: '' },
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(false);

  useEffect(() => {
    loadTeachers();
  }, [course]); // Reload teachers when course changes

  // Debug effect to monitor teacher loading state
  useEffect(() => {
    console.log('Teacher state debug:', {
      teachersLoading,
      teachersCount: teachers.length,
      teachers: teachers.map(t => ({ id: t.id, name: t.name })),
      course: course?.id
    });
  }, [teachersLoading, teachers, course]);

  // OLD CODE - Commented out due to infinite loading issues
  /*
  const loadTeachers = async () => {
    setTeachersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      if (!token) {
        showToast('Authentication required', 'error');
        setTeachersLoading(false);
        return;
      }
      
      // Load teachers filtered by selected course
      let teachersEndpoint = `${apiUrl}/api/admin/teachers`;
      if (course?.id) {
        teachersEndpoint = `${apiUrl}/api/admin/teachers/course/${encodeURIComponent(course.id)}`;
      }
      
      console.log('Loading teachers for course:', course?.id);
      const teachersResponse = await fetch(teachersEndpoint, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (teachersResponse.ok) {
        const teachersData = await teachersResponse.json();
        const allTeachers = Array.isArray(teachersData) ? teachersData : teachersData.teachers || [];
        console.log('All teachers loaded:', allTeachers.length);
        console.log('Teachers for course:', course?.id, ':', allTeachers.map(t => ({ id: t.id, name: t.name, domain: t.domain })));
        setTeachers(allTeachers);
      } else {
        showToast('Failed to load teachers', 'error');
        setTeachers([]);
      }
      
      // Load students for course-specific filtering (separate from teachers loading)
      const studentsResponse = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (studentsResponse.ok) {
        const allStudentsData = await studentsResponse.json();
        const allStudents = allStudentsData || [];
        
        // Filter students by selected course (same logic as main component)
        const filteredStudents = allStudents.filter(student => {
          // Only show students whose course matches selected course
          if (course?.id) {
            const courseLower = course.id.toLowerCase();
            const studentCourseLower = (student.course || '').toLowerCase();
            
            // Handle different course name variations
            const isCyberSecurityCourse = courseLower.includes('cyber') || courseLower.includes('security') || courseLower.includes('cs&eh');
            const studentIsCyberSecurityCourse = studentCourseLower.includes('cyber') || studentCourseLower.includes('security') || studentCourseLower.includes('cs&eh');
            
            const isDataScienceCourse = courseLower.includes('data') || courseLower.includes('science') || courseLower.includes('ai');
            const studentIsDataScienceCourse = studentCourseLower.includes('data') || studentCourseLower.includes('science') || studentCourseLower.includes('ai');
            
            const courseMatches = ((isCyberSecurityCourse && studentIsCyberSecurityCourse) || 
                  (isDataScienceCourse && studentIsDataScienceCourse) ||
                  courseLower === studentCourseLower);
            
            if (!courseMatches) {
              return false;
            }
          }
          
          // Only show students who don't have a batch assigned (batchId is null, undefined, or empty)
          if (student.batchId) {
            return false;
          }
          
          // Additional check for valid batch assignment
          const hasValidBatch = student.batchId && 
            String(student.batchId).trim() !== '' && 
            String(student.batchId).trim() !== 'null' && 
            String(student.batchId).trim() !== 'undefined';
          
          if (hasValidBatch) {
            return false;
          }
          
          return true;
        });
        
        console.log(`Loaded ${filteredStudents.length} unassigned students for course: ${course?.title}`);
        setStudents(filteredStudents);
      } else {
        showToast('Failed to load students', 'error');
        setStudents([]);
      }
    } catch (error) {
      showToast('Error loading data', 'error');
      setStudents([]);
      setTeachers([]);
    } finally {
      setTeachersLoading(false);
    }
  };
  */

  // COMPLETELY REWRITTEN - Simple and reliable teacher loading
  const loadTeachers = async () => {
    console.log('=== loadTeachers START ===');
    
    // Force loading state to true
    setTeachersLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      if (!token) {
        console.log('No token found');
        setTeachersLoading(false);
        return;
      }
      
      console.log('Fetching teachers...');
      
      // Simple API call to get all teachers
      const response = await fetch(`${apiUrl}/api/admin/teachers`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Teachers API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        const allTeachers = Array.isArray(data) ? data : [];
        console.log('Teachers loaded:', allTeachers.length);
        
        // Simple filtering - if course selected, filter, otherwise show all
        let filteredTeachers = allTeachers;
        
        if (course?.id) {
          const courseLower = course.id.toLowerCase();
          console.log('Filtering teachers for course:', courseLower);
          
          filteredTeachers = allTeachers.filter(teacher => {
            const domain = (teacher.domain || '').toLowerCase();
            const name = (teacher.name || '').toLowerCase();
            
            // Simple keyword matching
            if (courseLower.includes('data') && (domain.includes('data') || name.includes('data'))) {
              return true;
            }
            if (courseLower.includes('cyber') && (domain.includes('cyber') || name.includes('cyber'))) {
              return true;
            }
            if (courseLower.includes('security') && (domain.includes('security') || name.includes('security'))) {
              return true;
            }
            if (courseLower.includes('ai') && (domain.includes('ai') || name.includes('ai'))) {
              return true;
            }
            
            return false;
          });
          
          // If no matches, show all teachers
          if (filteredTeachers.length === 0) {
            console.log('No matches, showing all teachers');
            filteredTeachers = allTeachers;
          }
        }
        
        console.log('Final filtered teachers:', filteredTeachers.length);
        console.log('Setting teachers state...');
        
        // Set teachers first
        setTeachers(filteredTeachers);
        
        // Then set loading to false with a small delay to ensure state update
        setTimeout(() => {
          console.log('Setting teachersLoading to false (delayed)');
          setTeachersLoading(false);
        }, 100);
        
      } else {
        console.log('API call failed');
        setTeachers([]);
        setTeachersLoading(false);
      }
      
    } catch (error) {
      console.error('Error in loadTeachers:', error);
      setTeachers([]);
      setTeachersLoading(false);
    }
    
    console.log('=== loadTeachers END ===');
  };

  const [step, setStep] = useState(1); // Step 1: Create batch, Step 2: Add student
  const [createdBatch, setCreatedBatch] = useState(null);

  useEffect(() => {
    if (step === 2) {
      loadStudents();
    }
  }, [step, loadStudents]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTeacherSelect = (teacher) => {
    setFormData(prev => ({
      ...prev,
      teacherId: teacher.id,
      teacherName: teacher.name
    }));
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Creating batch with data:', {
        name: formData.name,
        course: course.id,
        courseTitle: course.title,
        teacherId: formData.teacherId,
        teacherName: formData.teacherName,
        startDate: formData.startDate,
        endDate: formData.endDate
      });

      const batchData = {
        name: formData.name,
        course: course.id,
        courseTitle: course.title,
        teacherId: formData.teacherId,
        teacherName: formData.teacherName,
        startDate: formData.startDate ? new Date(formData.startDate) : new Date(),
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        schedule: formData.schedule,
        notes: formData.notes,
        // Set placeholder student info that will be updated later
        studentId: null,
        studentName: 'To be assigned',
        studentEmail: 'To be assigned'
      };

      console.log('Sending batch data to API:', batchData);
      const response = await oneToOneBatchService.createBatch(batchData);
      console.log('Batch creation response:', response);
      
      if (response.success) {
        setCreatedBatch(response.batch);
        onBatchCreated(response.batch);
        // Move to step 2 for student assignment
        setStep(2);
        showToast('Batch created successfully!', 'success');
      } else {
        console.error('Batch creation failed:', response);
        showToast(response.message || 'Failed to create batch', 'error');
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      showToast(error.message || 'Error creating batch', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStudent = async () => {
    if (!selectedStudent || !createdBatch) return;
    
    setLoading(true);
    try {
      const response = await oneToOneBatchService.updateStudent(createdBatch.id, {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentEmail: selectedStudent.email
      });
      
      if (response.success) {
        showToast('Student assigned successfully', 'success');
        onClose();
      } else {
        showToast('Failed to assign student', 'error');
      }
    } catch (error) {
      console.error('Error assigning student:', error);
      showToast('Error assigning student', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content add-batch-modal">
        <div className="modal-header">
          <h3>Step {step} of 2: {step === 1 ? 'Create Batch' : 'Assign Student'}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {step === 1 ? (
          <form onSubmit={handleCreateBatch} className="batch-form">
            <div className="form-group">
              <label>Batch Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., John Doe - Data Science Basics"
                required
              />
            </div>

            <div className="form-group">
              <label>Teacher *</label>
              <div className="teacher-input-group">
                <select
                  value={formData.teacherId}
                  onChange={(e) => {
                    const teacher = teachers.find(t => t.id === e.target.value);
                    handleTeacherSelect(teacher);
                  }}
                  required
                  disabled={teachersLoading}
                >
                  <option value="">Select Teacher</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} {teacher.domain ? `(${teacher.domain})` : ''}
                    </option>
                  ))}
                </select>
                <button 
                  type="button" 
                  onClick={loadTeachers}
                  className="refresh-teachers-btn"
                  title="Refresh teachers"
                  disabled={teachersLoading}
                >
                  {teachersLoading ? '⏳' : '🔄'}
                </button>
              </div>
              {teachers.length > 0 && course && (
                <small className="form-hint">
                  Showing {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} for "{course.title}"
                </small>
              )}
              {teachers.length === 0 && !teachersLoading && (
                <small className="form-hint" style={{color: 'orange'}}>
                  No teachers found. Click refresh to reload.
                </small>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Any additional notes about this batch..."
                rows="3"
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Batch & Continue'}
              </button>
            </div>
          </form>
        ) : (
          <div className="student-assignment-form">
            <div className="batch-created-info">
              <h4>✅ Batch Created Successfully!</h4>
              <p><strong>Batch Name:</strong> {createdBatch?.name}</p>
              <p><strong>Course:</strong> {course.title}</p>
              <p><strong>Teacher:</strong> {createdBatch?.teacherName}</p>
            </div>

            <div className="form-group">
              <label>Assign Student *</label>
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Search student by name or email..."
              />
              {searchStudent && students.filter(student =>
                student.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                student.email.toLowerCase().includes(searchStudent.toLowerCase())
              ).length > 0 && (
                <div className="student-search-results">
                  {students.filter(student =>
                    student.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                    student.email.toLowerCase().includes(searchStudent.toLowerCase())
                  ).map(student => (
                    <div
                      key={student.id}
                      className="student-result-item"
                      onClick={() => handleStudentSelect(student)}
                    >
                      <strong>{student.name}</strong>
                      <small>{student.email}</small>
                      <span className="student-course">📚 {student.course}</span>
                    </div>
                  ))}
                </div>
              )}
              {!searchStudent && students.length > 0 && (
                <div className="student-search-results">
                  <div className="student-search-info">
                    📋 Showing {students.length} unassigned students for <strong>{course.title}</strong>
                  </div>
                  {students.slice(0, 5).map(student => (
                    <div
                      key={student.id}
                      className="student-result-item"
                      onClick={() => handleStudentSelect(student)}
                    >
                      <strong>{student.name}</strong>
                      <small>{student.email}</small>
                      <span className="student-course">📚 {student.course}</span>
                    </div>
                  ))}
                  {students.length > 5 && (
                    <div className="student-more-info">
                      ... and {students.length - 5} more students (use search to find specific students)
                    </div>
                  )}
                </div>
              )}
              {selectedStudent && (
                <div className="selected-student">
                  <strong>Selected Student:</strong> {selectedStudent.name} ({selectedStudent.email})
                </div>
              )}
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="btn-skip" 
                onClick={() => {
                  showToast('Batch created without student. You can assign student later.', 'info');
                  onClose();
                }}
              >
                Skip for Now
              </button>
              <button 
                type="button" 
                className="btn-submit" 
                onClick={handleAssignStudent}
                disabled={loading || !selectedStudent}
              >
                {loading ? 'Assigning...' : 'Assign Student'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OneToOneCourseSelection;
