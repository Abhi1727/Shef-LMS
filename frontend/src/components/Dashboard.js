import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModule, setSelectedModule] = useState(1);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);

  // Complete Course Curriculum - Cyber Security & Ethical Hacking
  const courseData = {
    title: 'Cyber Security & Ethical Hacking',
    duration: '10 months',
    modules: 10,
    progress: 0,
    lessons: '0/520',
    modules_detail: [
      {
        id: 1,
        name: 'Module 1: Introduction to Cyber Security and Ethical Hacking',
        duration: '3 weeks',
        lessons: 52,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Basics of Cyber Security and Threat Landscape',
            lessons: ['What is Cyber Security?', 'Common Cyber Threats and Attack Vectors', 'Security Goals and CIA Triad']
          },
          {
            id: 2,
            title: 'Ethical Hacking Concepts and Types of Hackers',
            lessons: ['Understanding Ethical Hacking', 'Black Hat, White Hat, and Grey Hat Hackers', 'Legal and Ethical Responsibilities']
          },
          {
            id: 3,
            title: 'Phases of Ethical Hacking',
            lessons: ['Reconnaissance', 'Scanning and Enumeration', 'Exploitation, Post-Exploitation, and Reporting']
          },
          {
            id: 4,
            title: 'Security and Risk Management',
            lessons: ['Risk Identification and Assessment', 'Risk Mitigation and Control Measures', 'Security Policies and Frameworks']
          }
        ]
      },
      {
        id: 2,
        name: 'Module 2: Networking Fundamentals for Cyber Security',
        duration: '4 weeks',
        lessons: 48,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Networking Concepts',
            lessons: ['OSI and TCP/IP Models', 'IP Addressing and Subnetting', 'Network Devices and Topologies']
          },
          {
            id: 2,
            title: 'Networking Protocols',
            lessons: ['HTTP, DNS, FTP, SMTP Overview', 'How Protocols Are Exploited', 'Securing Common Network Protocols']
          },
          {
            id: 3,
            title: 'Network Security Devices',
            lessons: ['Firewalls and Their Configuration', 'IDS and IPS Fundamentals', 'Proxy Servers and VPNs']
          },
          {
            id: 4,
            title: 'Packet Analysis and Monitoring',
            lessons: ['Introduction to Wireshark', 'Capturing and Inspecting Packets', 'Identifying Suspicious Network Traffic']
          }
        ]
      },
      {
        id: 3,
        name: 'Module 3: Linux Fundamentals',
        duration: '4 weeks',
        lessons: 56,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Introduction to Linux',
            lessons: ['Basics of the Linux Operating System', 'Linux Distributions for Cyber Security (Kali, Parrot OS)', 'Setting Up the Lab Environment']
          },
          {
            id: 2,
            title: 'Linux File System and Directory Structure',
            lessons: ['Navigating File Systems', 'File Permissions and Ownership', 'Hidden Files and Configuration Paths']
          },
          {
            id: 3,
            title: 'Command Line and System Management',
            lessons: ['Essential Linux Commands for Security Tasks', 'Managing Users, Groups, and Permissions', 'Process Management and System Monitoring']
          },
          {
            id: 4,
            title: 'Shell Scripting for Cyber Security',
            lessons: ['Basics of Bash Scripting', 'Writing Security Automation Scripts', 'Task Scheduling and Automation with Cron Jobs']
          }
        ]
      },
      {
        id: 4,
        name: 'Module 4: Reconnaissance and Footprinting',
        duration: '4 weeks',
        lessons: 50,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Active and Passive Reconnaissance',
            lessons: ['OSINT Techniques and Data Sources', 'Passive Scanning and Metadata Extraction', 'Active Network Probing']
          },
          {
            id: 2,
            title: 'Information Gathering Tools',
            lessons: ['WHOIS, NSLookup, and Dig', 'Recon-ng and Maltego', 'Shodan and Censys for Network Discovery']
          },
          {
            id: 3,
            title: 'Network Scanning with Nmap',
            lessons: ['Nmap Basics and Syntax', 'Service Version and OS Detection', 'Vulnerability Scanning with Nmap Scripts']
          },
          {
            id: 4,
            title: 'Identifying Devices and Open Ports',
            lessons: ['Network Mapping', 'Device Fingerprinting', 'Service Enumeration and Banner Grabbing']
          }
        ]
      },
      {
        id: 5,
        name: 'Module 5: Vulnerability Analysis',
        duration: '4 weeks',
        lessons: 54,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Vulnerability Assessment Methodologies',
            lessons: ['Understanding Vulnerability Management', 'Assessment Phases and Workflows', 'Vulnerability Scoring Systems (CVSS)']
          },
          {
            id: 2,
            title: 'Tools for Vulnerability Scanning',
            lessons: ['Nessus Overview and Setup', 'OWASP ZAP for Web Scanning', 'Comparing Automated and Manual Scans']
          },
          {
            id: 3,
            title: 'Identifying CVEs and Exploits',
            lessons: ['Using Exploit Databases (Exploit-DB, CVE Details)', 'Mapping Vulnerabilities to Exploits', 'Validating Vulnerabilities']
          },
          {
            id: 4,
            title: 'Analyzing Vulnerability Reports',
            lessons: ['Report Interpretation and Prioritization', 'False Positive Analysis', 'Remediation Planning']
          }
        ]
      },
      {
        id: 6,
        name: 'Module 6: System Hacking',
        duration: '4 weeks',
        lessons: 52,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Password Cracking Techniques',
            lessons: ['Dictionary and Brute-Force Attacks', 'Tools (Hydra, John the Ripper, Hashcat)', 'Password Policy Enforcement']
          },
          {
            id: 2,
            title: 'Privilege Escalation',
            lessons: ['Windows Privilege Escalation', 'Linux Privilege Escalation', 'Maintaining Access']
          },
          {
            id: 3,
            title: 'Backdoors and Trojans',
            lessons: ['Creating and Detecting Backdoors', 'RATs and Persistence Mechanisms', 'Defense Against Backdoors']
          },
          {
            id: 4,
            title: 'Anti-Forensics Techniques',
            lessons: ['Covering Tracks and Clearing Logs', 'Steganography and Data Hiding', 'Rootkits and Evasion']
          }
        ]
      },
      {
        id: 7,
        name: 'Module 7: Web Application Security',
        duration: '4 weeks',
        lessons: 56,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'OWASP Top 10 Vulnerabilities',
            lessons: ['Injection Attacks (SQLi, Command Injection)', 'Authentication and Session Issues', 'Security Misconfigurations']
          },
          {
            id: 2,
            title: 'Hands-On Labs (Juice Shop, DVWA)',
            lessons: ['Setting Up Vulnerable Web Apps', 'Exploiting Common Vulnerabilities', 'Writing Secure Code to Prevent Attacks']
          },
          {
            id: 3,
            title: 'Exploiting Web Vulnerabilities',
            lessons: ['SQL Injection Exploits', 'XSS and CSRF Attacks', 'File Upload and Directory Traversal']
          },
          {
            id: 4,
            title: 'Web Security Tools',
            lessons: ['Burp Suite for Interception', 'SQLmap for Injection Testing', 'ZAP Proxy for Automated Scans']
          }
        ]
      },
      {
        id: 8,
        name: 'Module 8: Wireless Network Security',
        duration: '4 weeks',
        lessons: 52,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Wireless Network Fundamentals',
            lessons: ['Wi-Fi Standards and Protocols', 'Authentication Mechanisms', 'Encryption (WEP, WPA, WPA2, WPA3)']
          },
          {
            id: 2,
            title: 'Wireless Attacks and Tools',
            lessons: ['Packet Capture and Sniffing', 'Deauthentication and Handshake Captures', 'WPA/WPA2 Cracking Tools']
          },
          {
            id: 3,
            title: 'Wireless Network Exploitation',
            lessons: ['Evil Twin Attacks', 'Rogue AP Setup', 'MITM on Wireless Networks']
          },
          {
            id: 4,
            title: 'Securing Wireless Networks',
            lessons: ['Implementing WPA3 and MAC Filtering', 'Wireless IDS/IPS', 'Secure Network Configuration Practices']
          }
        ]
      },
      {
        id: 9,
        name: 'Module 9: Penetration Testing Methodologies',
        duration: '5 weeks',
        lessons: 60,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Planning and Scoping',
            lessons: ['Defining Engagement Rules', 'Scoping and Legal Considerations', 'Project Documentation Templates']
          },
          {
            id: 2,
            title: 'Penetration Testing Process',
            lessons: ['Pre-Engagement Activities', 'Execution and Reporting', 'Validation of Findings']
          },
          {
            id: 3,
            title: 'Reporting and Documentation',
            lessons: ['Writing Professional Pen Test Reports', 'Communicating Findings to Clients', 'Mitigation Recommendations']
          },
          {
            id: 4,
            title: 'Real-World Simulations',
            lessons: ['Simulated Enterprise Network Attack', 'Exploitation to Post-Exploitation', 'Defensive Countermeasures']
          }
        ]
      },
      {
        id: 10,
        name: 'Module 10: Advanced Topics in Cyber Security',
        duration: '4 weeks',
        lessons: 44,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Cloud Security',
            lessons: ['Common Cloud Vulnerabilities', 'Cloud Security Controls and IAM', 'Securing Cloud Applications']
          },
          {
            id: 2,
            title: 'IoT Security',
            lessons: ['IoT Architecture and Attack Surface', 'Common IoT Threats', 'Securing IoT Devices']
          },
          {
            id: 3,
            title: 'Threat Hunting and Mitigation',
            lessons: ['Understanding Threat Intelligence', 'Detection and Response Strategies', 'Using SIEM Tools for Threat Analysis']
          }
        ]
      }
    ]
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Set minimum loading time to 2 seconds
      const startTime = Date.now();
      
      const [statsRes, coursesRes, activitiesRes] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get('/api/courses'),
        axios.get('/api/dashboard/activity')
      ]);

      // Reset all stats to 0 for fresh start
      const resetStats = {
        enrolled: 0,
        completed: 0,
        inProgress: 0,
        totalHours: 0,
        certificates: 0,
        upcomingClasses: 0
      };

      // Reset all courses progress to 0
      const resetCourses = (statsRes.data && Array.isArray(statsRes.data)) ? 
        statsRes.data.map(course => ({ ...course, progress: 0 })) : 
        coursesRes.data.map(course => ({ ...course, progress: 0 })) || [];

      // Reset activities to empty
      const resetActivities = [];

      setStats(resetStats);
      setCourses(resetCourses);
      setActivities(resetActivities);
      
      // Ensure loading animation shows for at least 2 seconds
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(2000 - elapsedTime, 0);
      
      setTimeout(() => {
        setLoading(false);
      }, remainingTime);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      // Reset to 0 on error
      setStats({ enrolled: 0, completed: 0, inProgress: 0, totalHours: 0, certificates: 0, upcomingClasses: 0 });
      setCourses([]);
      setActivities([]);
      
      // Still respect 2-second minimum on error
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">📚</span>
            <h2>SHEF LMS</h2>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
            title="Home"
          >
            <span className="icon">🏠</span>
            <span>Home</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveSection('courses')}
            title="Learn"
          >
            <span className="icon">�</span>
            <span>Learn</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveSection('activity')}
            title="Practice"
          >
            <span className="icon">✏️</span>
            <span>Practice</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveSection('projects')}
            title="Projects"
          >
            <span className="icon">�</span>
            <span>Projects</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'career' ? 'active' : ''}`}
            onClick={() => setActiveSection('career')}
            title="Career"
          >
            <span className="icon">🎯</span>
            <span>Career</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'mentorship' ? 'active' : ''}`}
            onClick={() => setActiveSection('mentorship')}
            title="Mentorship"
          >
            <span className="icon">�</span>
            <span>Mentorship</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'jobboard' ? 'active' : ''}`}
            onClick={() => setActiveSection('jobboard')}
            title="Job Board"
          >
            <span className="icon">💼</span>
            <span>Job Board</span>
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
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-left">
            <h1>My Goal | Professional Certification in...</h1>
          </div>
          <div className="header-right">
            <div className="user-menu">
              <button className="notification-btn">🔔</button>
              <button 
                className="user-avatar-btn"
                onClick={() => setShowProfileModal(true)}
                title="View Profile"
              >
                {user?.name?.charAt(0)}
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="dashboard-content">
          {activeSection === 'overview' && (
            <>
              {/* Hero Section with Featured Program */}
              <div className="featured-program">
                <div className="featured-content">
                  <h2>Introducing our brand new partnership with Shef USA</h2>
                  <p>Advance your cybersecurity skills with industry-recognized certification</p>
                  <div className="featured-buttons">
                    <button className="btn-primary">Explore Shef USA Program</button>
                    <button className="btn-secondary">Talk to Admissions Team</button>
                    <button className="btn-tertiary" onClick={() => window.open('https://shefusa.com/', '_blank')}>Visit Shef USA</button>
                  </div>
                </div>
                <div className="featured-image">
                  <div className="image-placeholder">Shef USA Partnership</div>
                </div>
              </div>

              {/* Current Course Section */}
              <div className="section">
                <div className="section-header">
                  <h2>Start Your Learning Journey</h2>
                  <div className="section-meta">
                    <span className="duration">{courseData.duration}</span>
                    <span className="modules">{courseData.modules} modules</span>
                  </div>
                </div>

                {/* Main Course Card */}
                <div className="main-course-card">
                  <div className="course-header">
                    <h3>{courseData.title}</h3>
                    <span className="course-tag">Get Started</span>
                  </div>
                  
                  <div className="course-modules">
                    <div className="module-item">
                      <span className="module-icon">�</span>
                      <span className="module-name">First Module</span>
                      <span className="module-desc">Introduction to Cyber Security and Ethical Hacking</span>
                    </div>
                    <div className="module-item">
                      <span className="module-icon">�</span>
                      <span className="module-name">First Lesson</span>
                      <span className="module-desc">What is Cyber Security?</span>
                    </div>
                  </div>

                  <div className="course-progress">
                    <div className="progress-bar-large">
                      <div className="progress-fill" style={{ width: '0%' }}></div>
                    </div>
                    <span className="progress-text">0%</span>
                  </div>

                  <button className="btn-continue" onClick={() => setActiveSection('courses')}>Start Learning →</button>
                </div>

                {/* Dashboard Walkthrough */}
                <div className="dashboard-info">
                  <div className="info-card">
                    <div className="info-icon">📊</div>
                    <h4>Dashboard Walkthrough</h4>
                    <p>Learn how to navigate your learning dashboard</p>
                    <button className="btn-small">View Classroom</button>
                  </div>
                  <div className="upcoming-classes">
                    <h4>📅 No upcoming class scheduled</h4>
                  </div>
                </div>
              </div>

              {/* Practice Coding Assessments */}
              <div className="section">
                <div className="section-header">
                  <h2>Practice Security Challenges</h2>
                  <button className="view-all-btn">See all</button>
                </div>
                <div className="practice-assessments-grid">
                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon">🔐</div>
                    </div>
                    <div className="assessment-content">
                      <h4>Network Security Challenges</h4>
                      <p className="assessment-meta">8 Questions | 90 Min</p>
                      <button className="btn-start">Start now →</button>
                      <button className="btn-share">⤓</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon">🛡️</div>
                    </div>
                    <div className="assessment-content">
                      <h4>Web Application Security Lab</h4>
                      <p className="assessment-meta">6 Questions | 120 Min</p>
                      <button className="btn-start">Start now →</button>
                      <button className="btn-share">⤓</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon">⚔️</div>
                    </div>
                    <div className="assessment-content">
                      <h4>CTF Challenges</h4>
                      <p className="assessment-meta">10 Questions | 180 Min</p>
                      <button className="btn-start">Start now →</button>
                      <button className="btn-share">⤓</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Practice Quiz Assessments */}
              <div className="section">
                <div className="section-header">
                  <h2>Practice Quiz Assessments</h2>
                  <button className="view-all-btn">See all</button>
                </div>
                <div className="practice-assessments-grid">
                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon nn-icon">CEH</div>
                    </div>
                    <div className="assessment-content">
                      <h4>CEH Mock Exam</h4>
                      <button className="btn-start">Start now →</button>
                      <button className="btn-share">⤓</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon microsoft-icon">�</div>
                    </div>
                    <div className="assessment-content">
                      <h4>CompTIA Security+ Practice Test</h4>
                      <button className="btn-start">Start now →</button>
                      <button className="btn-share">⤓</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon meta-icon">🌐</div>
                    </div>
                    <div className="assessment-content">
                      <h4>OSCP Preparation Quiz</h4>
                      <button className="btn-start">Start now →</button>
                      <button className="btn-share">⤓</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capstone Projects */}
              <div className="section">
                <div className="section-header">
                  <h2>Capstone Projects</h2>
                  <button className="view-all-btn">See all →</button>
                </div>
                <div className="capstone-projects-grid">
                  <div className="capstone-card">
                    <div className="capstone-icon" style={{ background: '#ffe6e6' }}>�</div>
                    <h4>Enterprise Network Penetration Test</h4>
                    <p className="capstone-course">End-to-End Security Assessment</p>
                    <button className="btn-start">Start now →</button>
                    <button className="btn-share">⬆️</button>
                  </div>
                  <div className="capstone-card">
                    <div className="capstone-icon" style={{ background: '#fff0e6' }}>🌐</div>
                    <h4>Web Application Security Audit</h4>
                    <p className="capstone-course">OWASP Top 10 Vulnerability Assessment</p>
                    <button className="btn-start">Start now →</button>
                    <button className="btn-share">⬆️</button>
                  </div>
                  <div className="capstone-card">
                    <div className="capstone-icon" style={{ background: '#e6f0ff' }}>�️</div>
                    <h4>Wireless Network Security Analysis</h4>
                    <p className="capstone-course">Wi-Fi Penetration Testing & Security</p>
                    <button className="btn-start">Start now →</button>
                    <button className="btn-share">⬆️</button>
                  </div>
                </div>
              </div>

              {/* Explore Supplementary Courses */}
              <div className="section">
                <div className="section-header">
                  <h2>Explore Supplementary Course</h2>
                  <button className="view-all-btn">See all →</button>
                </div>
                <div className="supplementary-courses-grid">
                  <div className="supplementary-card">
                    <div className="supplementary-badge">K</div>
                    <h4>Kali Linux Mastery</h4>
                    <p className="supplementary-meta">📚 32 Lessons • ⏱️ 18000 min</p>
                    <p className="supplementary-desc">Master Kali Linux tools and techniques for penetration testing and...</p>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '0%' }}></div>
                    </div>
                    <span className="progress-percent">0%</span>
                    <div className="supplementary-actions">
                      <button className="btn-view">View →</button>
                      <button className="btn-share">⬆️</button>
                    </div>
                  </div>
                  <div className="supplementary-card">
                    <div className="supplementary-badge" style={{ background: '#e6d9ff' }}>C</div>
                    <h4>Cloud Security</h4>
                    <p className="supplementary-meta">📚 28 Lessons • ⏱️ 16200 min</p>
                    <p className="supplementary-desc">AWS, Azure, and GCP security best practices, IAM, and cloud archi...</p>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '0%' }}></div>
                    </div>
                    <span className="progress-percent">0%</span>
                    <div className="supplementary-actions">
                      <button className="btn-view">View →</button>
                      <button className="btn-share">⬆️</button>
                    </div>
                  </div>
                  <div className="supplementary-card">
                    <div className="supplementary-badge" style={{ background: '#d9f0e6' }}>M</div>
                    <h4>Malware Analysis</h4>
                    <p className="supplementary-meta">📚 30 Lessons • ⏱️ 17400 min</p>
                    <p className="supplementary-desc">Reverse engineering, dynamic analysis, and threat detection techn...</p>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '0%' }}></div>
                    </div>
                    <span className="progress-percent">0%</span>
                    <div className="supplementary-actions">
                      <button className="btn-view">View →</button>
                      <button className="btn-share">⬆️</button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === 'courses' && (
            <div className="learn-section">
              <div className="section-header">
                <h2>{courseData.title}</h2>
                <p className="course-subtitle">{courseData.duration} • {courseData.modules} modules</p>
              </div>

              <div className="learn-container">
                <div className="learn-sidebar">
                  <div className="course-info">
                    <h3>{courseData.title}</h3>
                    <p>Data Science is an increasingly important field as companies struggle to make sense of the vast quantities of data they generate. AlmaBetter's Full Stack Data Science course is the perfect way for students to learn the data science necessary to excel in this exciting field with objectives in Business Analytics, Data Engineering, and Advanced Machine Learning, this immersive program covers everything from data...</p>
                    <button className="btn-resume">Resume Learning</button>
                  </div>

                  <div className="modules-list">
                    <h4>Modules ({courseData.modules})</h4>
                    {courseData.modules_detail.map((module) => (
                      <div 
                        key={module.id} 
                        className={`module-item ${selectedModule === module.id ? 'active' : ''}`}
                        onClick={() => setSelectedModule(module.id)}
                      >
                        <div className="module-icon">📚</div>
                        <div className="module-info">
                          <h5>{module.name}</h5>
                          <p>{module.lessons} Lessons • {module.duration}</p>
                        </div>
                        <div className="module-progress">
                          <span className="progress-text">{module.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="learn-main">
                  {courseData.modules_detail.map((module) => (
                    selectedModule === module.id && (
                      <div key={module.id}>
                        <div className="course-hero">
                          <div className="hero-content">
                            <h2>{module.name}</h2>
                            <p>{module.lessons} Lessons • {module.duration}</p>
                            <div className="course-stats">
                              <div className="stat">
                                <span className="stat-value">{module.progress}%</span>
                                <span className="stat-label">Progress</span>
                              </div>
                              <div className="stat">
                                <span className="stat-value">{module.lessons}</span>
                                <span className="stat-label">Total Lessons</span>
                              </div>
                            </div>
                          </div>
                          <div className="hero-progress-circle">
                            <svg width="150" height="150">
                              <circle cx="75" cy="75" r="65" fill="none" stroke="#e0e0e0" strokeWidth="6"/>
                              <circle 
                                cx="75" 
                                cy="75" 
                                r="65" 
                                fill="none" 
                                stroke="url(#gradient)" 
                                strokeWidth="6" 
                                strokeDasharray={`${2 * Math.PI * 65 * (module.progress / 100)} ${2 * Math.PI * 65}`}
                                strokeDashoffset="0"
                                transform="rotate(-90 75 75)"
                                style={{ transition: 'stroke-dasharray 0.5s' }}
                              />
                              <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#667eea"/>
                                  <stop offset="100%" stopColor="#764ba2"/>
                                </linearGradient>
                              </defs>
                              <text x="75" y="75" textAnchor="middle" dy=".3em" fontSize="28" fontWeight="bold" fill="#667eea">{module.progress}%</text>
                            </svg>
                          </div>
                        </div>

                        <div className="chapters-section">
                          <h3>Chapters & Lessons</h3>
                          <div className="chapters-list">
                            {module.chapters.map((chapter) => (
                              <div key={chapter.id} className="chapter-item">
                                <div className="chapter-header">
                                  <span className="chapter-number">Chapter {chapter.id}</span>
                                  <h4>{chapter.title}</h4>
                                  <span className="chapter-badge">{chapter.lessons.length} Lessons</span>
                                </div>
                                <div className="lessons-list">
                                  {chapter.lessons.map((lesson, idx) => (
                                    <div key={idx} className="lesson-item">
                                      <span className="lesson-icon">📖</span>
                                      <span className="lesson-name">Lesson {idx + 1}: {lesson}</span>
                                      <span className="lesson-status">✓</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'activity' && (
            <div className="section">
              <div className="section-header">
                <h2>Practice Cyber Security</h2>
                <p className="section-subtitle">Hands-on labs and challenges to sharpen your hacking skills</p>
              </div>

              {/* Practice Security Challenges */}
              <div className="practice-section">
                <h3>Security Challenges</h3>
                <div className="practice-assessments-grid">
                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon">🔐</div>
                    </div>
                    <div className="assessment-content">
                      <h4>Network Security Challenges</h4>
                      <p className="assessment-meta">8 Questions | 90 Min</p>
                      <p className="assessment-desc">Test your network security skills with real-world scenarios</p>
                      <button className="btn-start">Start now →</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon">🛡️</div>
                    </div>
                    <div className="assessment-content">
                      <h4>Web Application Security Lab</h4>
                      <p className="assessment-meta">6 Questions | 120 Min</p>
                      <p className="assessment-desc">Exploit vulnerabilities in web applications</p>
                      <button className="btn-start">Start now →</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon">⚔️</div>
                    </div>
                    <div className="assessment-content">
                      <h4>CTF Challenges</h4>
                      <p className="assessment-meta">10 Questions | 180 Min</p>
                      <p className="assessment-desc">Capture the flag challenges for advanced hackers</p>
                      <button className="btn-start">Start now →</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon">🔓</div>
                    </div>
                    <div className="assessment-content">
                      <h4>Cryptography Lab</h4>
                      <p className="assessment-meta">5 Questions | 60 Min</p>
                      <p className="assessment-desc">Crack encryption and decode messages</p>
                      <button className="btn-start">Start now →</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon">🎭</div>
                    </div>
                    <div className="assessment-content">
                      <h4>Social Engineering Scenarios</h4>
                      <p className="assessment-meta">7 Questions | 75 Min</p>
                      <p className="assessment-desc">Master the art of social engineering attacks</p>
                      <button className="btn-start">Start now →</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon">🔍</div>
                    </div>
                    <div className="assessment-content">
                      <h4>Forensics Investigation</h4>
                      <p className="assessment-meta">9 Questions | 150 Min</p>
                      <p className="assessment-desc">Investigate digital crimes and analyze evidence</p>
                      <button className="btn-start">Start now →</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Practice Quizzes */}
              <div className="practice-section">
                <h3>Certification Practice Tests</h3>
                <div className="practice-assessments-grid">
                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon nn-icon">CEH</div>
                    </div>
                    <div className="assessment-content">
                      <h4>CEH Mock Exam</h4>
                      <p className="assessment-desc">125 Questions | 4 Hours</p>
                      <button className="btn-start">Start now →</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon microsoft-icon">�</div>
                    </div>
                    <div className="assessment-content">
                      <h4>CompTIA Security+ Practice Test</h4>
                      <p className="assessment-desc">90 Questions | 90 Min</p>
                      <button className="btn-start">Start now →</button>
                    </div>
                  </div>

                  <div className="assessment-card">
                    <div className="assessment-header">
                      <div className="assessment-icon meta-icon">🌐</div>
                    </div>
                    <div className="assessment-content">
                      <h4>OSCP Preparation Quiz</h4>
                      <p className="assessment-desc">50 Questions | 120 Min</p>
                      <button className="btn-start">Start now →</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'projects' && (
            <div className="section">
              <div className="section-header">
                <h2>Cyber Security Projects</h2>
                <p className="section-subtitle">Build real-world projects to demonstrate your skills</p>
              </div>

              {/* Capstone Projects */}
              <div className="projects-section">
                <h3>Capstone Projects</h3>
                <div className="capstone-projects-grid">
                  <div className="capstone-card">
                    <div className="capstone-icon" style={{ background: '#ffe6e6' }}>�</div>
                    <h4>Enterprise Network Penetration Test</h4>
                    <p className="capstone-course">End-to-End Security Assessment</p>
                    <p className="project-desc">Conduct a full penetration test on a simulated enterprise network, identify vulnerabilities, and provide remediation recommendations.</p>
                    <div className="project-meta">
                      <span>⏱️ 4 weeks</span>
                      <span>🎯 Advanced</span>
                    </div>
                    <button className="btn-start">Start Project →</button>
                  </div>

                  <div className="capstone-card">
                    <div className="capstone-icon" style={{ background: '#fff0e6' }}>🌐</div>
                    <h4>Web Application Security Audit</h4>
                    <p className="capstone-course">OWASP Top 10 Vulnerability Assessment</p>
                    <p className="project-desc">Audit a web application for OWASP Top 10 vulnerabilities and create a comprehensive security report.</p>
                    <div className="project-meta">
                      <span>⏱️ 3 weeks</span>
                      <span>🎯 Intermediate</span>
                    </div>
                    <button className="btn-start">Start Project →</button>
                  </div>

                  <div className="capstone-card">
                    <div className="capstone-icon" style={{ background: '#e6f0ff' }}>�️</div>
                    <h4>Wireless Network Security Analysis</h4>
                    <p className="capstone-course">Wi-Fi Penetration Testing & Security</p>
                    <p className="project-desc">Analyze wireless network security, perform WPA2 cracking, and set up secure wireless infrastructure.</p>
                    <div className="project-meta">
                      <span>⏱️ 2 weeks</span>
                      <span>🎯 Intermediate</span>
                    </div>
                    <button className="btn-start">Start Project →</button>
                  </div>

                  <div className="capstone-card">
                    <div className="capstone-icon" style={{ background: '#e6ffe6' }}>🦠</div>
                    <h4>Malware Analysis Lab</h4>
                    <p className="capstone-course">Reverse Engineering & Detection</p>
                    <p className="project-desc">Set up a malware analysis lab and reverse engineer malicious software to understand attack vectors.</p>
                    <div className="project-meta">
                      <span>⏱️ 3 weeks</span>
                      <span>🎯 Advanced</span>
                    </div>
                    <button className="btn-start">Start Project →</button>
                  </div>

                  <div className="capstone-card">
                    <div className="capstone-icon" style={{ background: '#f0e6ff' }}>☁️</div>
                    <h4>Cloud Security Assessment</h4>
                    <p className="capstone-course">AWS/Azure Security Audit</p>
                    <p className="project-desc">Assess cloud infrastructure security, identify misconfigurations, and implement security best practices.</p>
                    <div className="project-meta">
                      <span>⏱️ 3 weeks</span>
                      <span>🎯 Advanced</span>
                    </div>
                    <button className="btn-start">Start Project →</button>
                  </div>

                  <div className="capstone-card">
                    <div className="capstone-icon" style={{ background: '#ffe6f0' }}>🔴</div>
                    <h4>Red Team Operation</h4>
                    <p className="capstone-course">Full-Scale Attack Simulation</p>
                    <p className="project-desc">Execute a complete red team operation including reconnaissance, exploitation, and post-exploitation.</p>
                    <div className="project-meta">
                      <span>⏱️ 5 weeks</span>
                      <span>🎯 Expert</span>
                    </div>
                    <button className="btn-start">Start Project →</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'career' && (
            <div className="section">
              <div className="section-header">
                <h2>Career Development</h2>
                <p className="section-subtitle">Launch your cybersecurity career with expert guidance</p>
              </div>

              {/* Career Resources */}
              <div className="career-section">
                <div className="career-stats">
                  <div className="career-stat-card">
                    <div className="stat-icon">💼</div>
                    <h3>850+</h3>
                    <p>Job Opportunities</p>
                  </div>
                  <div className="career-stat-card">
                    <div className="stat-icon">🏢</div>
                    <h3>200+</h3>
                    <p>Hiring Partners</p>
                  </div>
                  <div className="career-stat-card">
                    <div className="stat-icon">💰</div>
                    <h3>$95K</h3>
                    <p>Average Salary</p>
                  </div>
                  <div className="career-stat-card">
                    <div className="stat-icon">📈</div>
                    <h3>92%</h3>
                    <p>Placement Rate</p>
                  </div>
                </div>

                <h3>Career Services</h3>
                <div className="career-services-grid">
                  <div className="service-card">
                    <div className="service-icon">📝</div>
                    <h4>Resume Building</h4>
                    <p>Get expert help crafting an ATS-friendly cybersecurity resume that stands out</p>
                    <button className="btn-secondary">Build Resume</button>
                  </div>

                  <div className="service-card">
                    <div className="service-icon">🎤</div>
                    <h4>Interview Preparation</h4>
                    <p>Practice with mock interviews and get feedback from industry professionals</p>
                    <button className="btn-secondary">Start Practice</button>
                  </div>

                  <div className="service-card">
                    <div className="service-icon">🎯</div>
                    <h4>Career Counseling</h4>
                    <p>One-on-one sessions with career advisors to plan your cybersecurity path</p>
                    <button className="btn-secondary">Book Session</button>
                  </div>

                  <div className="service-card">
                    <div className="service-icon">🌐</div>
                    <h4>LinkedIn Optimization</h4>
                    <p>Optimize your LinkedIn profile to attract recruiters and opportunities</p>
                    <button className="btn-secondary">Optimize Profile</button>
                  </div>

                  <div className="service-card">
                    <div className="service-icon">📚</div>
                    <h4>Portfolio Development</h4>
                    <p>Build a professional portfolio showcasing your projects and skills</p>
                    <button className="btn-secondary">Create Portfolio</button>
                  </div>

                  <div className="service-card">
                    <div className="service-icon">🤝</div>
                    <h4>Networking Events</h4>
                    <p>Connect with industry professionals at exclusive networking events</p>
                    <button className="btn-secondary">View Events</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'mentorship' && (
            <div className="section">
              <div className="section-header">
                <h2>Mentorship Program</h2>
                <p className="section-subtitle">Learn from experienced cybersecurity professionals</p>
              </div>

              {/* Mentors Grid */}
              <div className="mentorship-section">
                <h3>Available Mentors</h3>
                <div className="mentors-grid">
                  <div className="mentor-card">
                    <div className="mentor-avatar">👨‍💻</div>
                    <h4>John Smith</h4>
                    <p className="mentor-title">Senior Penetration Tester</p>
                    <p className="mentor-company">Google | 12 years exp</p>
                    <div className="mentor-skills">
                      <span className="skill-tag">Pentesting</span>
                      <span className="skill-tag">Web Security</span>
                      <span className="skill-tag">Network Security</span>
                    </div>
                    <p className="mentor-desc">Specialized in web application security and penetration testing</p>
                    <button className="btn-primary">Request Mentorship</button>
                  </div>

                  <div className="mentor-card">
                    <div className="mentor-avatar">👩‍💻</div>
                    <h4>Sarah Johnson</h4>
                    <p className="mentor-title">Security Architect</p>
                    <p className="mentor-company">Microsoft | 10 years exp</p>
                    <div className="mentor-skills">
                      <span className="skill-tag">Cloud Security</span>
                      <span className="skill-tag">IAM</span>
                      <span className="skill-tag">Compliance</span>
                    </div>
                    <p className="mentor-desc">Expert in cloud security architecture and compliance frameworks</p>
                    <button className="btn-primary">Request Mentorship</button>
                  </div>

                  <div className="mentor-card">
                    <div className="mentor-avatar">👨‍💼</div>
                    <h4>Michael Chen</h4>
                    <p className="mentor-title">Red Team Lead</p>
                    <p className="mentor-company">Amazon | 8 years exp</p>
                    <div className="mentor-skills">
                      <span className="skill-tag">Red Teaming</span>
                      <span className="skill-tag">OSINT</span>
                      <span className="skill-tag">Social Engineering</span>
                    </div>
                    <p className="mentor-desc">Leads red team operations and advanced threat simulations</p>
                    <button className="btn-primary">Request Mentorship</button>
                  </div>

                  <div className="mentor-card">
                    <div className="mentor-avatar">👩‍🔬</div>
                    <h4>Emily Davis</h4>
                    <p className="mentor-title">Malware Analyst</p>
                    <p className="mentor-company">CrowdStrike | 9 years exp</p>
                    <div className="mentor-skills">
                      <span className="skill-tag">Malware Analysis</span>
                      <span className="skill-tag">Reverse Engineering</span>
                      <span className="skill-tag">Threat Intel</span>
                    </div>
                    <p className="mentor-desc">Specializes in advanced malware analysis and threat intelligence</p>
                    <button className="btn-primary">Request Mentorship</button>
                  </div>

                  <div className="mentor-card">
                    <div className="mentor-avatar">👨‍🏫</div>
                    <h4>David Martinez</h4>
                    <p className="mentor-title">Security Consultant</p>
                    <p className="mentor-company">Deloitte | 15 years exp</p>
                    <div className="mentor-skills">
                      <span className="skill-tag">GRC</span>
                      <span className="skill-tag">Risk Management</span>
                      <span className="skill-tag">Auditing</span>
                    </div>
                    <p className="mentor-desc">Expert in governance, risk, and compliance strategies</p>
                    <button className="btn-primary">Request Mentorship</button>
                  </div>

                  <div className="mentor-card">
                    <div className="mentor-avatar">👩‍⚖️</div>
                    <h4>Lisa Anderson</h4>
                    <p className="mentor-title">Incident Response Lead</p>
                    <p className="mentor-company">FireEye | 11 years exp</p>
                    <div className="mentor-skills">
                      <span className="skill-tag">Incident Response</span>
                      <span className="skill-tag">Forensics</span>
                      <span className="skill-tag">SIEM</span>
                    </div>
                    <p className="mentor-desc">Leads incident response teams and digital forensics investigations</p>
                    <button className="btn-primary">Request Mentorship</button>
                  </div>
                </div>

                <div className="mentorship-benefits">
                  <h3>Mentorship Benefits</h3>
                  <div className="benefits-grid">
                    <div className="benefit-item">
                      <span className="benefit-icon">🎯</span>
                      <p>Personalized career guidance</p>
                    </div>
                    <div className="benefit-item">
                      <span className="benefit-icon">💡</span>
                      <p>Industry insights and trends</p>
                    </div>
                    <div className="benefit-item">
                      <span className="benefit-icon">🔍</span>
                      <p>Code and project reviews</p>
                    </div>
                    <div className="benefit-item">
                      <span className="benefit-icon">🤝</span>
                      <p>Networking opportunities</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'jobboard' && (
            <div className="section">
              <div className="section-header">
                <h2>Job Board</h2>
                <p className="section-subtitle">Find your dream cybersecurity job</p>
              </div>

              {/* Job Filters */}
              <div className="job-filters">
                <input type="text" placeholder="Search jobs..." className="search-input" />
                <select className="filter-select">
                  <option>All Locations</option>
                  <option>Remote</option>
                  <option>On-site</option>
                  <option>Hybrid</option>
                </select>
                <select className="filter-select">
                  <option>All Experience Levels</option>
                  <option>Entry Level</option>
                  <option>Mid Level</option>
                  <option>Senior Level</option>
                </select>
                <select className="filter-select">
                  <option>All Job Types</option>
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                </select>
              </div>

              {/* Job Listings */}
              <div className="jobs-section">
                <div className="job-card">
                  <div className="job-header">
                    <div className="company-logo">🏢</div>
                    <div className="job-title-section">
                      <h4>Penetration Tester</h4>
                      <p className="company-name">Google</p>
                    </div>
                    <span className="job-badge new">New</span>
                  </div>
                  <div className="job-details">
                    <span className="job-detail">📍 Remote</span>
                    <span className="job-detail">💰 $95K - $130K</span>
                    <span className="job-detail">⏱️ Full-time</span>
                    <span className="job-detail">📅 Posted 2 days ago</span>
                  </div>
                  <p className="job-description">
                    We're seeking an experienced penetration tester to join our security team. You'll conduct security assessments and help protect our infrastructure.
                  </p>
                  <div className="job-skills">
                    <span className="skill-tag">Pentesting</span>
                    <span className="skill-tag">Kali Linux</span>
                    <span className="skill-tag">Burp Suite</span>
                    <span className="skill-tag">Python</span>
                  </div>
                  <button className="btn-primary">Apply Now</button>
                </div>

                <div className="job-card">
                  <div className="job-header">
                    <div className="company-logo">🏢</div>
                    <div className="job-title-section">
                      <h4>Security Analyst</h4>
                      <p className="company-name">Microsoft</p>
                    </div>
                    <span className="job-badge">Featured</span>
                  </div>
                  <div className="job-details">
                    <span className="job-detail">📍 Seattle, WA</span>
                    <span className="job-detail">💰 $80K - $110K</span>
                    <span className="job-detail">⏱️ Full-time</span>
                    <span className="job-detail">📅 Posted 5 days ago</span>
                  </div>
                  <p className="job-description">
                    Join our security operations center and monitor threats, investigate incidents, and implement security controls.
                  </p>
                  <div className="job-skills">
                    <span className="skill-tag">SIEM</span>
                    <span className="skill-tag">Incident Response</span>
                    <span className="skill-tag">Threat Analysis</span>
                    <span className="skill-tag">Splunk</span>
                  </div>
                  <button className="btn-primary">Apply Now</button>
                </div>

                <div className="job-card">
                  <div className="job-header">
                    <div className="company-logo">🏢</div>
                    <div className="job-title-section">
                      <h4>Cloud Security Engineer</h4>
                      <p className="company-name">Amazon Web Services</p>
                    </div>
                    <span className="job-badge new">New</span>
                  </div>
                  <div className="job-details">
                    <span className="job-detail">📍 Remote</span>
                    <span className="job-detail">💰 $110K - $150K</span>
                    <span className="job-detail">⏱️ Full-time</span>
                    <span className="job-detail">📅 Posted 1 day ago</span>
                  </div>
                  <p className="job-description">
                    Design and implement security solutions for cloud infrastructure. Experience with AWS security services required.
                  </p>
                  <div className="job-skills">
                    <span className="skill-tag">AWS</span>
                    <span className="skill-tag">Cloud Security</span>
                    <span className="skill-tag">IAM</span>
                    <span className="skill-tag">Terraform</span>
                  </div>
                  <button className="btn-primary">Apply Now</button>
                </div>

                <div className="job-card">
                  <div className="job-header">
                    <div className="company-logo">🏢</div>
                    <div className="job-title-section">
                      <h4>Cybersecurity Consultant</h4>
                      <p className="company-name">Deloitte</p>
                    </div>
                  </div>
                  <div className="job-details">
                    <span className="job-detail">📍 New York, NY</span>
                    <span className="job-detail">💰 $90K - $125K</span>
                    <span className="job-detail">⏱️ Full-time</span>
                    <span className="job-detail">📅 Posted 1 week ago</span>
                  </div>
                  <p className="job-description">
                    Work with clients to assess security posture, develop strategies, and implement security frameworks and controls.
                  </p>
                  <div className="job-skills">
                    <span className="skill-tag">GRC</span>
                    <span className="skill-tag">Risk Assessment</span>
                    <span className="skill-tag">NIST</span>
                    <span className="skill-tag">ISO 27001</span>
                  </div>
                  <button className="btn-primary">Apply Now</button>
                </div>

                <div className="job-card">
                  <div className="job-header">
                    <div className="company-logo">🏢</div>
                    <div className="job-title-section">
                      <h4>Malware Analyst</h4>
                      <p className="company-name">CrowdStrike</p>
                    </div>
                    <span className="job-badge">Featured</span>
                  </div>
                  <div className="job-details">
                    <span className="job-detail">📍 Remote</span>
                    <span className="job-detail">💰 $100K - $140K</span>
                    <span className="job-detail">⏱️ Full-time</span>
                    <span className="job-detail">📅 Posted 3 days ago</span>
                  </div>
                  <p className="job-description">
                    Analyze malware samples, reverse engineer threats, and develop detection signatures for our threat intelligence platform.
                  </p>
                  <div className="job-skills">
                    <span className="skill-tag">Reverse Engineering</span>
                    <span className="skill-tag">IDA Pro</span>
                    <span className="skill-tag">Assembly</span>
                    <span className="skill-tag">Malware Analysis</span>
                  </div>
                  <button className="btn-primary">Apply Now</button>
                </div>

                <div className="job-card">
                  <div className="job-header">
                    <div className="company-logo">🏢</div>
                    <div className="job-title-section">
                      <h4>Application Security Engineer</h4>
                      <p className="company-name">Facebook (Meta)</p>
                    </div>
                  </div>
                  <div className="job-details">
                    <span className="job-detail">📍 Menlo Park, CA</span>
                    <span className="job-detail">💰 $120K - $160K</span>
                    <span className="job-detail">⏱️ Full-time</span>
                    <span className="job-detail">📅 Posted 4 days ago</span>
                  </div>
                  <p className="job-description">
                    Secure our applications by conducting code reviews, security testing, and implementing secure development practices.
                  </p>
                  <div className="job-skills">
                    <span className="skill-tag">AppSec</span>
                    <span className="skill-tag">SAST/DAST</span>
                    <span className="skill-tag">OWASP</span>
                    <span className="skill-tag">Secure Coding</span>
                  </div>
                  <button className="btn-primary">Apply Now</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Student Profile</h2>
              <button 
                className="close-btn" 
                onClick={() => setShowProfileModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="profile-content">
              <div className="profile-avatar-section">
                <div className="large-avatar">{user?.name?.charAt(0)}</div>
              </div>

              <div className="profile-details">
                <div className="detail-group">
                  <label>Full Name</label>
                  <p>{user?.name || 'N/A'}</p>
                </div>

                <div className="detail-group">
                  <label>Email Address</label>
                  <p>{user?.email || 'N/A'}</p>
                </div>

                <div className="detail-group">
                  <label>Student ID</label>
                  <p>{user?.enrollmentNumber || 'SU-2025-001'}</p>
                </div>

                <div className="detail-group">
                  <label>Role</label>
                  <p className="badge-role">{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1) || 'Student'}</p>
                </div>

                <div className="detail-group">
                  <label>Current Course</label>
                  <p>{user?.currentCourse || 'Cyber Security & Ethical Hacking'}</p>
                </div>

                <div className="detail-group">
                  <label>Progress</label>
                  <p>0% - Just Started</p>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-edit">Edit Profile</button>
              <button className="btn-download">Download Certificate</button>
              <button className="btn-close" onClick={() => setShowProfileModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Help Button */}
      <button 
        className="help-button"
        onClick={() => setShowHelpMenu(!showHelpMenu)}
        title="Help"
      >
        <span className="help-icon">?</span>
        <span className="help-text">Help</span>
      </button>

      {/* Help Menu Popup */}
      {showHelpMenu && (
        <div className="help-menu">
          <button className="help-menu-item" onClick={() => alert('Live Support coming soon!')}>
            <span className="help-menu-icon">💬</span>
            <span>Live Support</span>
          </button>
          <button className="help-menu-item" onClick={() => alert('Resources coming soon!')}>
            <span className="help-menu-icon">📚</span>
            <span>Resources</span>
          </button>
          <button className="help-menu-item" onClick={() => alert('Raise a ticket coming soon!')}>
            <span className="help-menu-icon">🎫</span>
            <span>Raise a ticket</span>
          </button>
          <button className="help-menu-item" onClick={() => alert('AI Chat coming soon!')}>
            <span className="help-menu-icon">🤖</span>
            <span>AI Chat</span>
          </button>
          <button 
            className="help-menu-close"
            onClick={() => setShowHelpMenu(false)}
            title="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
