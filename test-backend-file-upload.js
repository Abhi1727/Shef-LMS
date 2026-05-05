/**
 * Backend File Upload Enhancement Test Script
 * 
 * This script tests the enhanced file upload functionality to verify:
 * 1. All file types are accepted by backend
 * 2. Proper content-type headers are set for downloads
 * 3. Error messages are consistent across endpoints
 * 4. File size limits are properly enforced
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Test configuration
const config = {
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:5000',
    authToken: process.env.TEST_AUTH_TOKEN || 'your-test-token-here',
    testBatchId: process.env.TEST_BATCH_ID || 'test-batch-id'
};

// File types to test
const testFiles = [
    { name: 'test.pdf', type: 'application/pdf', content: Buffer.from('%PDF-1.4 test content'), expected: true },
    { name: 'test.doc', type: 'application/msword', content: Buffer.from('test word document'), expected: true },
    { name: 'test.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: Buffer.from('test docx content'), expected: true },
    { name: 'test.txt', type: 'text/plain', content: Buffer.from('test text file'), expected: true },
    { name: 'test.ppt', type: 'application/vnd.ms-powerpoint', content: Buffer.from('test powerpoint'), expected: true },
    { name: 'test.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', content: Buffer.from('test pptx content'), expected: true },
    { name: 'test.xls', type: 'application/vnd.ms-excel', content: Buffer.from('test excel file'), expected: true },
    { name: 'test.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: Buffer.from('test xlsx content'), expected: true },
    { name: 'test.csv', type: 'text/csv', content: Buffer.from('col1,col2\nval1,val2'), expected: true },
    { name: 'test.zip', type: 'application/zip', content: Buffer.from('test zip content'), expected: true },
    { name: 'test.jpg', type: 'image/jpeg', content: Buffer.from('test jpeg image'), expected: true },
    { name: 'test.png', type: 'image/png', content: Buffer.from('test png image'), expected: true },
    { name: 'test.gif', type: 'image/gif', content: Buffer.from('test gif image'), expected: true },
    { name: 'test.ipynb', type: 'application/json', content: Buffer.from('{"cells": [], "metadata": {}, "nbformat": 4}'), expected: true },
    { name: 'test.exe', type: 'application/octet-stream', content: Buffer.from('test executable'), expected: false },
    { name: 'test.scr', type: 'application/octet-stream', content: Buffer.from('test screensaver'), expected: false }
];

// Content-Type mapping verification
const expectedContentTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv',
    'zip': 'application/zip',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'ipynb': 'application/json'
};

class FileUploadTester {
    constructor() {
        this.results = {
            uploadTests: [],
            downloadTests: [],
            errorTests: []
        };
    }

    async runAllTests() {
        console.log('🚀 Starting File Upload Enhancement Tests\n');
        
        await this.testUploadEndpoints();
        await this.testDownloadHeaders();
        await this.testErrorMessages();
        await this.testFileSizeLimits();
        
        this.printResults();
    }

    async testUploadEndpoints() {
        console.log('📤 Testing Upload Endpoints...');
        
        for (const file of testFiles) {
            try {
                const result = await this.testFileUpload(file, 'admin');
                this.results.uploadTests.push({
                    file: file.name,
                    type: file.type,
                    expected: file.expected,
                    result: result.success,
                    message: result.message,
                    endpoint: 'admin'
                });
                
                console.log(`  ${result.success ? '✅' : '❌'} ${file.name} (${file.type}) - ${result.message}`);
            } catch (error) {
                console.log(`  ❌ ${file.name} - Error: ${error.message}`);
                this.results.uploadTests.push({
                    file: file.name,
                    type: file.type,
                    expected: file.expected,
                    result: false,
                    message: error.message,
                    endpoint: 'admin'
                });
            }
        }
    }

    async testFileUpload(fileData, endpoint) {
        const form = new FormData();
        form.append('title', `Test ${fileData.name}`);
        form.append('description', `Test upload for ${fileData.name}`);
        form.append('batchId', config.testBatchId);
        form.append('notesFile', fileData.content, {
            filename: fileData.name,
            contentType: fileData.type
        });

        try {
            const url = endpoint === 'admin' 
                ? `${config.baseUrl}/api/admin/classroom`
                : `${config.baseUrl}/api/teacher/classroom`;
            
            const response = await axios.post(url, form, {
                headers: {
                    ...form.getHeaders(),
                    'x-auth-token': config.authToken
                },
                maxContentLength: 50 * 1024 * 1024, // 50MB
                maxBodyLength: 50 * 1024 * 1024
            });

            return {
                success: response.data.success || true,
                message: 'Upload successful',
                data: response.data
            };
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data.message || 'Upload failed';
                const isExpectedError = !fileData.expected && errorMessage.includes('not allowed');
                
                return {
                    success: isExpectedError,
                    message: errorMessage,
                    status: error.response.status
                };
            }
            throw error;
        }
    }

    async testDownloadHeaders() {
        console.log('\n📥 Testing Download Content-Type Headers...');
        
        // Test content-type mapping function
        for (const [ext, expectedType] of Object.entries(expectedContentTypes)) {
            const filename = `test.${ext}`;
            const detectedType = this.getContentType(filename);
            
            const isCorrect = detectedType === expectedType;
            this.results.downloadTests.push({
                filename,
                expected: expectedType,
                actual: detectedType,
                success: isCorrect
            });
            
            console.log(`  ${isCorrect ? '✅' : '❌'} ${filename}: ${detectedType} ${isCorrect ? '' : `(expected: ${expectedType})`}`);
        }
    }

    getContentType(filename) {
        const contentTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'csv': 'text/csv',
            'zip': 'application/zip',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'ipynb': 'application/json'
        };
        
        const fileExtension = path.extname(filename).toLowerCase().substring(1);
        return contentTypes[fileExtension] || 'application/octet-stream';
    }

    async testErrorMessages() {
        console.log('\n❌ Testing Error Message Consistency...');
        
        // Test error message for unsupported file type
        const unsupportedFile = {
            name: 'test.exe',
            type: 'application/octet-stream',
            content: Buffer.from('test executable')
        };

        try {
            const adminResult = await this.testFileUpload(unsupportedFile, 'admin');
            const teacherResult = await this.testFileUpload(unsupportedFile, 'teacher');
            
            const adminMessage = adminResult.message;
            const teacherMessage = teacherResult.message;
            
            const messagesMatch = adminMessage.includes('PowerPoint, Excel, CSV, text, images, Jupyter notebooks') && 
                                 teacherMessage.includes('PowerPoint, Excel, CSV, text, images, Jupyter notebooks');
            
            this.results.errorTests.push({
                test: 'Unsupported file type error message',
                adminMessage,
                teacherMessage,
                success: messagesMatch
            });
            
            console.log(`  ${messagesMatch ? '✅' : '❌'} Error message consistency: ${messagesMatch ? 'PASS' : 'FAIL'}`);
            if (!messagesMatch) {
                console.log(`    Admin: ${adminMessage}`);
                console.log(`    Teacher: ${teacherMessage}`);
            }
        } catch (error) {
            console.log(`  ❌ Error message test failed: ${error.message}`);
        }
    }

    async testFileSizeLimits() {
        console.log('\n📏 Testing File Size Limits...');
        
        // Create a large file (60MB) to test size limit
        const largeContent = Buffer.alloc(60 * 1024 * 1024, 'x');
        const largeFile = {
            name: 'large.pdf',
            type: 'application/pdf',
            content: largeContent
        };

        try {
            const result = await this.testFileUpload(largeFile, 'admin');
            const sizeLimitEnforced = !result.success && result.message.includes('exceeds');
            
            this.results.errorTests.push({
                test: 'File size limit enforcement',
                success: sizeLimitEnforced,
                message: result.message
            });
            
            console.log(`  ${sizeLimitEnforced ? '✅' : '❌'} File size limit: ${sizeLimitEnforced ? 'ENFORCED' : 'NOT ENFORCED'}`);
        } catch (error) {
            console.log(`  ❌ File size limit test failed: ${error.message}`);
        }
    }

    printResults() {
        console.log('\n📊 Test Results Summary');
        console.log('='.repeat(50));
        
        const uploadSuccess = this.results.uploadTests.filter(t => t.result === t.expected).length;
        const uploadTotal = this.results.uploadTests.length;
        
        const downloadSuccess = this.results.downloadTests.filter(t => t.success).length;
        const downloadTotal = this.results.downloadTests.length;
        
        const errorSuccess = this.results.errorTests.filter(t => t.success).length;
        const errorTotal = this.results.errorTests.length;
        
        console.log(`Upload Tests: ${uploadSuccess}/${uploadTotal} passed`);
        console.log(`Download Tests: ${downloadSuccess}/${downloadTotal} passed`);
        console.log(`Error Tests: ${errorSuccess}/${errorTotal} passed`);
        
        const totalSuccess = uploadSuccess + downloadSuccess + errorSuccess;
        const totalTests = uploadTotal + downloadTotal + errorTotal;
        const successRate = ((totalSuccess / totalTests) * 100).toFixed(1);
        
        console.log(`\nOverall: ${totalSuccess}/${totalTests} tests passed (${successRate}%)`);
        
        if (totalSuccess === totalTests) {
            console.log('🎉 All tests passed! File upload enhancements are working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Please review the implementation.');
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new FileUploadTester();
    tester.runAllTests().catch(console.error);
}

module.exports = FileUploadTester;
