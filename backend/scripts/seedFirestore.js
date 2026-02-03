#!/usr/bin/env node

/**
 * Firestore Database Seeding Script
 * This script populates Firestore with sample data for SHEF LMS
 * 
 * Usage:
 *   node scripts/seedFirestore.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '../config/firebase-admin-key.json');

try {
  // Check if service account file exists
  const fs = require('fs');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Error: firebase-admin-key.json not found at:', serviceAccountPath);
    console.error('\n📌 Steps to fix:');
    console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
    console.error('2. Click "Generate new private key"');
    console.error('3. Save as: backend/config/firebase-admin-key.json');
    process.exit(1);
  }

  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// Sample data
const sampleData = {
  users: {
    admin1: {
      name: "Super Admin",
      email: "admin@sheflms.com",
      password: "$2b$10$1c7z1iAMraS3lW.ZlBXS1ezsvX9TH7wvMKoGZzGPgx5XoaRVTHtp6",
      role: "admin",
      status: "active",
      createdAt: new Date("2025-11-01"),
      updatedAt: new Date("2025-11-01")
    },
    student1: {
      name: "Leonardo De Leon",
      email: "lqdeleon@gmail.com",
      password: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWDeBlkxiRlO.J4m",
      role: "student",
      status: "active",
      enrollmentNumber: "SU-2025-001",
      course: "Cyber Security & Ethical Hacking",
      phone: "+1-234-567-8900",
      address: "123 Main St, New York, NY",
      createdAt: new Date("2025-11-07"),
      updatedAt: new Date("2025-11-07")
    },
    student2: {
      name: "Emma Johnson",
      email: "emma.johnson@example.com",
      password: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWDeBlkxiRlO.J4m",
      role: "student",
      status: "active",
      enrollmentNumber: "SU-2025-002",
      course: "Data Science & AI",
      phone: "+1-345-678-9012",
      address: "456 Oak Ave, San Francisco, CA",
      createdAt: new Date("2025-11-08"),
      updatedAt: new Date("2025-11-08")
    },
    teacher1: {
      name: "Dr. Sarah Mitchell",
      email: "teacher@sheflms.com",
      password: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWDeBlkxiRlO.J4m",
      role: "teacher",
      status: "active",
      age: 35,
      domain: "Cyber Security & Ethical Hacking",
      experience: "8 years in cybersecurity education",
      phone: "+1-555-0123",
      address: "789 University Ave, Boston, MA",
      createdAt: new Date("2025-10-20"),
      updatedAt: new Date("2025-11-01")
    }
  },
  courses: {
    course1: {
      title: "Cyber Security & Ethical Hacking",
      description: "Master cybersecurity fundamentals, penetration testing, and ethical hacking techniques.",
      duration: "6 months",
      instructor: "John Smith",
      modules: 6,
      price: "$999",
      status: "active",
      enrollmentCount: 2,
      teacherId: "teacher_cybersecurity_id",
      domain: "Cyber Security & Ethical Hacking",
      createdAt: new Date("2025-10-15"),
      updatedAt: new Date("2025-11-01")
    },
    course2: {
      title: "Data Science & AI",
      description: "Master data analysis, machine learning, deep learning, and AI applications with Python.",
      duration: "6 months",
      instructor: "Dr. Sarah Mitchell",
      modules: 8,
      price: "$1299",
      status: "active",
      enrollmentCount: 1,
      teacherId: "teacher_datascience_id",
      domain: "Data Science & AI",
      createdAt: new Date("2025-10-20"),
      updatedAt: new Date("2025-11-02")
    }
  },
  modules: {
    mod1: {
      name: "Networking Fundamentals",
      courseId: "course1",
      description: "Learn TCP/IP, DNS, HTTP protocols, routing, and network security basics.",
      duration: "3 weeks",
      lessons: 4,
      order: 1,
      status: "active",
      createdAt: new Date("2025-10-15"),
      updatedAt: new Date("2025-11-01")
    },
    mod2: {
      name: "Security Tools & Frameworks",
      courseId: "course1",
      description: "Master penetration testing tools like Metasploit, Burp Suite, and Wireshark.",
      duration: "4 weeks",
      lessons: 5,
      order: 2,
      status: "active",
      createdAt: new Date("2025-10-20"),
      updatedAt: new Date("2025-11-01")
    }
  },
  lessons: {
    les1: {
      title: "Introduction to Networking",
      moduleId: "mod1",
      content: "Understand the basics of computer networks, IP addressing, and how data travels across the internet.",
      duration: "45 min",
      videoUrl: "https://www.youtube.com/embed/qiQR5rTSshw",
      classLink: "https://zoom.us/meeting/example",
      order: 1,
      status: "active",
      createdAt: new Date("2025-10-15"),
      updatedAt: new Date("2025-11-01")
    },
    les2: {
      title: "TCP/IP Protocol Stack",
      moduleId: "mod1",
      content: "Deep dive into TCP/IP layers, protocols, and how they interact.",
      duration: "1 hour",
      videoUrl: "https://www.youtube.com/embed/PwQ1lVYISqc",
      classLink: "https://zoom.us/meeting/example",
      order: 2,
      status: "active",
      createdAt: new Date("2025-10-16"),
      updatedAt: new Date("2025-11-01")
    }
  },
  projects: {
    proj1: {
      title: "Penetration Testing Capstone",
      description: "Perform a complete security audit on a target system.",
      difficulty: "Hard",
      duration: "2 weeks",
      skills: ["Networking", "Security Tools", "Reporting"],
      requirements: "Deploy test environment and document findings",
      deliverables: "Written report, video walkthrough, tools used",
      courseId: "course1",
      status: "active",
      createdAt: new Date("2025-10-25"),
      updatedAt: new Date("2025-11-01")
    }
  },
  assessments: {
    assess1: {
      title: "CEH Practice Exam",
      description: "50-question practice exam for CEH certification preparation.",
      questions: 50,
      duration: "2 hours",
      difficulty: "Hard",
      passingScore: 75,
      type: "exam",
      courseId: "course1",
      status: "active",
      createdAt: new Date("2025-10-15"),
      updatedAt: new Date("2025-11-01")
    }
  },
  jobs: {
    job1: {
      title: "Security Analyst",
      company: "Tech Corp",
      description: "We're looking for an experienced security analyst to monitor threats.",
      location: "Remote",
      salary: "$95K - $130K",
      type: "Full-time",
      skills: ["Networking", "Security", "SIEM Tools"],
      status: "active",
      postedDate: new Date("2025-11-01"),
      appliedCount: 0,
      createdAt: new Date("2025-11-01"),
      updatedAt: new Date("2025-11-01")
    },
    job2: {
      title: "Penetration Tester",
      company: "SecureNet Inc",
      description: "Conduct security assessments and penetration tests on client systems.",
      location: "New York, NY",
      salary: "$110K - $150K",
      type: "Full-time",
      skills: ["Penetration Testing", "Networking", "Linux"],
      status: "active",
      postedDate: new Date("2025-11-02"),
      appliedCount: 2,
      createdAt: new Date("2025-11-02"),
      updatedAt: new Date("2025-11-02")
    }
  },
  mentors: {
    ment1: {
      name: "Alex Johnson",
      title: "Senior Security Engineer",
      company: "CyberGuard Solutions",
      email: "alex@cyberguard.com",
      linkedin: "https://linkedin.com/in/alexjohnson",
      experience: "12 years",
      skills: ["Penetration Testing", "Networking", "Forensics", "Compliance"],
      bio: "Passionate about teaching the next generation of security professionals.",
      menteeCount: 3,
      availability: "available",
      createdAt: new Date("2025-10-15"),
      updatedAt: new Date("2025-11-01")
    },
    ment2: {
      name: "Sarah Williams",
      title: "Chief Information Officer",
      company: "Tech Innovations Ltd",
      email: "sarah@techinnovations.com",
      linkedin: "https://linkedin.com/in/sarahwilliams",
      experience: "15 years",
      skills: ["Security Strategy", "Risk Management", "Compliance", "Leadership"],
      bio: "Mentor helping students navigate cybersecurity careers.",
      menteeCount: 5,
      availability: "available",
      createdAt: new Date("2025-10-16"),
      updatedAt: new Date("2025-11-01")
    }
  },
  content: {
    ann1: {
      type: "announcement",
      title: "Welcome to SHEF LMS!",
      content: "We're excited to have you here. Get started with our onboarding course.",
      targetAudience: "all",
      priority: "high",
      views: 0,
      published: true,
      createdAt: new Date("2025-11-01"),
      updatedAt: new Date("2025-11-01")
    },
    feature1: {
      type: "feature",
      title: "Live Classes Available",
      content: "Join live sessions with experienced instructors every week.",
      targetAudience: "students",
      priority: "normal",
      views: 0,
      published: true,
      createdAt: new Date("2025-11-01"),
      updatedAt: new Date("2025-11-01")
    }
  },
  stats: {
    main: {
      totalStudents: 2,
      activeStudents: 2,
      totalCourses: 2,
      activeCourses: 2,
      totalJobs: 2,
      activeJobs: 2,
      totalMentors: 2,
      completionRate: 85,
      lastUpdated: new Date()
    }
  }
};

/**
 * Seed a single collection
 */
async function seedCollection(collectionName, documents) {
  console.log(`\n📝 Seeding ${collectionName} collection...`);
  let count = 0;

  for (const [docId, docData] of Object.entries(documents)) {
    try {
      await db.collection(collectionName).doc(docId).set(docData);
      console.log(`  ✅ Created: ${docId}`);
      count++;
    } catch (error) {
      console.error(`  ❌ Error creating ${docId}:`, error.message);
    }
  }

  console.log(`  📊 Total: ${count}/${Object.keys(documents).length} documents created`);
  return count;
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  console.log('\n🔥 Starting SHEF LMS Firestore Database Seeding...\n');
  console.log('=' .repeat(60));

  let totalDocuments = 0;

  try {
    // Seed each collection
    for (const [collectionName, documents] of Object.entries(sampleData)) {
      const count = await seedCollection(collectionName, documents);
      totalDocuments += count;
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✨ Database seeding completed successfully!');
    console.log(`\n📊 Total documents created: ${totalDocuments}`);
    console.log('\n📋 Collections created:');
    console.log('  ✅ users');
    console.log('  ✅ courses');
    console.log('  ✅ modules');
    console.log('  ✅ lessons');
    console.log('  ✅ projects');
    console.log('  ✅ assessments');
    console.log('  ✅ jobs');
    console.log('  ✅ mentors');
    console.log('  ✅ content');
    console.log('  ✅ stats');
    
    console.log('\n🔐 Test Credentials:');
    console.log('  Admin Email: admin@sheflms.com');
    console.log('  Password: SuperAdmin@123');
    console.log('\n  Student Email: lqdeleon@gmail.com');
    console.log('  Password: Admin@123');
    
    console.log('\n💡 Next steps:');
    console.log('  1. Go to Firebase Console to verify the data');
    console.log('  2. Start the backend server: npm start');
    console.log('  3. Start the frontend: npm start (in frontend folder)');
    console.log('  4. Login with the test credentials above');
    console.log('\n🎉 Happy Learning!\n');

  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

// Run the seeding
seedDatabase();
