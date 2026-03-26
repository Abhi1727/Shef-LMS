/**
 * Input validation and sanitization for teacher endpoints
 */

const sanitize = require('mongo-sanitize');
const validator = require('validator');

/**
 * Sanitize and validate video title/description updates
 */
function validateVideoUpdate(req, res, next) {
  try {
    const { title, description } = req.body;
    
    // Validate title if provided
    if (title !== undefined) {
      if (typeof title !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Title must be a string' 
        });
      }
      
      if (title.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Title cannot be empty' 
        });
      }
      
      if (title.length > 200) {
        return res.status(400).json({ 
          success: false, 
          message: 'Title cannot exceed 200 characters' 
        });
      }
      
      // Sanitize title
      req.body.title = sanitize(title.trim());
    }
    
    // Validate description if provided
    if (description !== undefined) {
      if (typeof description !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Description must be a string' 
        });
      }
      
      if (description.length > 1000) {
        return res.status(400).json({ 
          success: false, 
          message: 'Description cannot exceed 1000 characters' 
        });
      }
      
      // Sanitize description
      req.body.description = sanitize(description.trim());
    }
    
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Validation error' 
    });
  }
}

/**
 * Validate file uploads for notes
 */
function validateNotesUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({ 
        success: false, 
        message: 'File size cannot exceed 10MB' 
      });
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only PDF, DOC, and DOCX files are allowed' 
      });
    }
    
    // Sanitize filename
    const originalName = req.file.originalname;
    if (originalName.length > 255) {
      return res.status(400).json({ 
        success: false, 
        message: 'Filename is too long' 
      });
    }
    
    // Check for malicious filename patterns
    if (originalName.includes('../') || originalName.includes('..\\')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid filename' 
      });
    }
    
    next();
  } catch (error) {
    console.error('File validation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'File validation error' 
    });
  }
}

/**
 * Validate batch creation/update data
 */
function validateBatchData(req, res, next) {
  try {
    const { name, course, status } = req.body;
    
    // Validate batch name
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Batch name is required and must be a string' 
      });
    }
    
    if (name.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Batch name cannot be empty' 
      });
    }
    
    if (name.length > 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Batch name cannot exceed 100 characters' 
      });
    }
    
    // Validate course
    if (!course || typeof course !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Course is required and must be a string' 
      });
    }
    
    // Validate status if provided
    if (status && !['active', 'inactive', 'completed'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status must be one of: active, inactive, completed' 
      });
    }
    
    // Sanitize inputs
    req.body.name = sanitize(name.trim());
    req.body.course = sanitize(course.trim());
    if (status) req.body.status = sanitize(status);
    
    next();
  } catch (error) {
    console.error('Batch validation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Batch validation error' 
    });
  }
}

/**
 * Validate MongoDB ObjectId
 */
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    try {
      const id = req.params[paramName];
      
      if (!id) {
        return res.status(400).json({ 
          success: false, 
          message: `${paramName} is required` 
        });
      }
      
      // Basic ObjectId format validation (24 hex characters)
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid ${paramName} format` 
        });
      }
      
      next();
    } catch (error) {
      console.error('ObjectId validation error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Validation error' 
      });
    }
  };
}

/**
 * Rate limiting helper for sensitive operations
 */
const rateLimitMap = new Map();

function rateLimit(maxRequests = 10, windowMs = 60000) {
  return (req, res, next) => {
    try {
      const key = `${req.user.id}-${req.path}`;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, []);
      }
      
      const requests = rateLimitMap.get(key);
      
      // Remove old requests outside the window
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      
      if (validRequests.length >= maxRequests) {
        return res.status(429).json({ 
          success: false, 
          message: 'Too many requests. Please try again later.' 
        });
      }
      
      validRequests.push(now);
      rateLimitMap.set(key, validRequests);
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Continue on error, don't block requests
    }
  };
}

module.exports = {
  validateVideoUpdate,
  validateNotesUpload,
  validateBatchData,
  validateObjectId,
  rateLimit
};
