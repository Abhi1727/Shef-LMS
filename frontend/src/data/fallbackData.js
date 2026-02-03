// Fallback data for admin panel when Firebase quota is exceeded
const fallbackData = {
  users: [
    {
      id: 'student1',
      name: 'Leonardo De Leon',
      email: 'lqdeleon@gmail.com',
      role: 'student',
      status: 'active',
      enrollmentNumber: 'SU-2025-001',
      course: 'Cyber Security & Ethical Hacking',
      phone: '+1-234-567-8900',
      address: '123 Main St, New York, NY',
      createdAt: '2025-11-07T00:00:00Z',
      updatedAt: '2025-11-07T00:00:00Z'
    },
    {
      id: 'student2',
      name: 'Emma Johnson',
      email: 'emma.johnson@example.com',
      role: 'student',
      status: 'active',
      enrollmentNumber: 'SU-2025-002',
      course: 'Full Stack Web Development',
      phone: '+1-345-678-9012',
      address: '456 Oak Ave, San Francisco, CA',
      createdAt: '2025-11-08T00:00:00Z',
      updatedAt: '2025-11-08T00:00:00Z'
    },
    {
      id: 'student3',
      name: 'Michael Chen',
      email: 'michael.chen@example.com',
      role: 'student',
      status: 'active',
      enrollmentNumber: 'SU-2025-003',
      course: 'Cyber Security & Ethical Hacking',
      phone: '+1-456-789-0123',
      address: '789 Pine Rd, Austin, TX',
      createdAt: '2025-11-09T00:00:00Z',
      updatedAt: '2025-11-09T00:00:00Z'
    }
  ],
  teachers: [
    {
      id: 'teacher1',
      name: 'Dr. Sarah Mitchell',
      email: 'teacher@sheflms.com',
      role: 'teacher',
      status: 'active',
      age: 35,
      domain: 'Cyber Security & Ethical Hacking',
      experience: '8 years in cybersecurity education',
      phone: '+1-555-0123',
      address: '789 University Ave, Boston, MA',
      createdAt: '2025-10-20T00:00:00Z',
      updatedAt: '2025-11-01T00:00:00Z'
    }
  ],
  courses: [
    {
      id: 'course1',
      title: 'Cyber Security & Ethical Hacking',
      description: 'Master cybersecurity fundamentals, penetration testing, and ethical hacking techniques.',
      duration: '6 months',
      instructor: 'John Smith',
      modules: 6,
      price: '$999',
      status: 'active',
      enrollmentCount: 2,
      createdAt: '2025-10-15T00:00:00Z',
      updatedAt: '2025-11-01T00:00:00Z'
    },
    {
      id: 'course2',
      title: 'Full Stack Web Development',
      description: 'Learn to build complete web applications using modern frontend and backend technologies.',
      duration: '5 months',
      instructor: 'Jane Doe',
      modules: 5,
      price: '$899',
      status: 'active',
      enrollmentCount: 1,
      createdAt: '2025-10-20T00:00:00Z',
      updatedAt: '2025-11-02T00:00:00Z'
    }
  ],
  classroom: [
    {
      id: 'video1',
      title: 'Introduction to Cyber Security',
      instructor: 'Dr. Sarah Mitchell',
      duration: '1 hr 30 min',
      date: '2025-01-15',
      courseType: 'Cyber Security & Ethical Hacking',
      type: 'Lecture',
      videoSource: 'youtube-url',
      youtubeVideoId: 'dQw4w9WgXcQ',
      youtubeVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtubeEmbedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      courseId: 'course1',
      uploadedBy: 'admin1',
      createdAt: '2025-01-15T10:00:00Z'
    }
  ]
};

export default fallbackData;
