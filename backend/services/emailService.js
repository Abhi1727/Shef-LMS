const nodemailer = require('nodemailer');
const Imap = require('imap');
require('dotenv').config();

// Create email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // false for port 587 (TLS), true for port 465 (SSL)
    auth: {
      user: process.env.EMAIL_USER || 'support@skystates.us',
      pass: process.env.EMAIL_PASS || 'Xziant@123'
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates
    }
  });
};

// Create IMAP connection for saving to sent folder
const createImapConnection = () => {
  return new Imap({
    user: process.env.EMAIL_USER || 'support@skystates.us',
    password: process.env.EMAIL_PASS || 'Xziant@123',
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
    port: 993, // IMAP SSL port
    tls: {
      rejectUnauthorized: false
    },
    tlsOptions: {
      servername: process.env.EMAIL_HOST || 'smtp.hostinger.com'
    }
  });
};

// Save email to sent folder via IMAP
const saveToSentFolder = (emailData) => {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection();
    
    imap.once('ready', () => {
      imap.openBox('INBOX.Sent', false, (err, box) => {
        if (err) {
          // Try alternative sent folder names
          imap.openBox('Sent', false, (err, box) => {
            if (err) {
              imap.openBox('Sent Items', false, (err, box) => {
                if (err) {
                  imap.end();
                  reject(new Error('Could not open sent folder'));
                  return;
                }
                saveEmail();
              });
            } else {
              saveEmail();
            }
          });
        } else {
          saveEmail();
        }
        
        function saveEmail() {
          const email = [
            `From: ${emailData.from}`,
            `To: ${emailData.to}`,
            `Subject: ${emailData.subject}`,
            `Date: ${new Date().toUTCString()}`,
            `Message-ID: ${emailData.messageId}`,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="boundary"',
            '',
            '--boundary',
            'Content-Type: text/plain; charset=utf-8',
            'Content-Transfer-Encoding: 7bit',
            '',
            emailData.text,
            '',
            '--boundary',
            'Content-Type: text/html; charset=utf-8',
            'Content-Transfer-Encoding: 7bit',
            '',
            emailData.html,
            '',
            '--boundary--'
          ].join('\r\n');
          
          imap.append(email, { mailbox: box.name, flags: ['\\Seen'] }, (err) => {
            imap.end();
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        }
      });
    });
    
    imap.once('error', (err) => {
      reject(err);
    });
    
    imap.connect();
  });
};

// Validate email addresses
const validateEmails = (emails) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = emails.filter(email => !emailRegex.test(email));
  
  if (invalidEmails.length > 0) {
    throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
  }
  
  return true;
};

// Send email to multiple recipients using BCC
const sendEmail = async (options) => {
  const { subject, message, studentEmails, batchId } = options;
  
  try {
    // Validate inputs
    if (!subject || !message || !studentEmails || studentEmails.length === 0) {
      throw new Error('Missing required fields: subject, message, or studentEmails');
    }
    
    // Validate email addresses
    validateEmails(studentEmails);
    
    // Create transporter
    const transporter = createTransporter();
    
    // Verify transporter connection
    await transporter.verify();
    
    // Send email to each student individually to maintain privacy and ensure proper sent folder behavior
    const results = [];
    
    // Convert plain text to HTML to preserve formatting
    const formatMessageAsHtml = (message) => {
      // First, escape HTML characters to prevent issues
      let htmlMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      
      // Convert double line breaks to paragraph breaks
      htmlMessage = htmlMessage.replace(/\n\n+/g, '</p><p>');
      
      // Convert single line breaks to <br> tags
      htmlMessage = htmlMessage.replace(/\n/g, '<br>');
      
      // Wrap in paragraphs with proper styling
      htmlMessage = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
          <p style="margin-bottom: 16px;">${htmlMessage}</p>
        </div>
      `;
      
      return htmlMessage;
    };
    
    const htmlMessage = formatMessageAsHtml(message);
    const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'demo@learnwithus.sbs';
    
    for (const studentEmail of studentEmails) {
      const mailOptions = {
        from: `"Sky States" <${senderEmail}>`,
        to: studentEmail, // Send to individual student only
        subject: subject,
        html: htmlMessage, // Use formatted HTML
        text: message, // Plain text fallback
        headers: {
          'X-Batch-ID': batchId || 'unknown',
          'X-Email-Type': 'batch-notification',
          'X-Student-Email': studentEmail,
          'X-Priority': '3', // Normal priority
          'X-Auto-Response-Suppress': 'All', // Suppress auto-replies
          'X-MS-Exchange-Organization-SCL': '-1', // Mark as not spam in Exchange
          'X-Original-Message-ID': `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@skystates.us`
        }
      };
      
      // Send individual email
      const info = await transporter.sendMail(mailOptions);
      
      // Save to sent folder via IMAP
      try {
        await saveToSentFolder({
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text,
          html: mailOptions.html,
          messageId: info.messageId
        });
        console.log(`Email saved to sent folder for ${studentEmail}`);
      } catch (imapError) {
        console.warn(`Failed to save to sent folder: ${imapError.message}`);
        // Continue even if IMAP fails - email was still sent
      }
      
      results.push({
        messageId: info.messageId,
        recipient: studentEmail
      });
      
      console.log(`Email sent to ${studentEmail}, Message ID: ${info.messageId}`);
    }
    
    console.log('Email sent successfully:', {
      totalEmails: results.length,
      recipientCount: studentEmails.length,
      subject: subject,
      batchId: batchId,
      messageIds: results.map(r => r.messageId)
    });
    
    return {
      success: true,
      messageId: results[0]?.messageId, // Return first message ID
      recipientCount: studentEmails.length,
      subject: subject,
      messageIds: results.map(r => r.messageId), // All message IDs
      recipients: results.map(r => r.recipient) // All recipients
    };
    
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send email';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check email credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server. Please check email configuration.';
    } else if (error.message.includes('Invalid email addresses')) {
      errorMessage = error.message;
    } else if (error.message.includes('Missing required fields')) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { success: true, message: 'Email configuration is valid' };
  } catch (error) {
    console.error('Email configuration test failed:', error);
    return { 
      success: false, 
      message: `Email configuration test failed: ${error.message}` 
    };
  }
};

module.exports = {
  sendEmail,
  testEmailConfig,
  validateEmails
};
