#!/usr/bin/env node

import http from 'http';

const data = JSON.stringify({
  title: 'Test Presentation',
  subtitle: 'Testing PPT from API',
  slides: [
    {
      title: 'Welcome',
      content: 'This is test slide 1'
    },
    {
      title: 'Slide 2', 
      content: 'This is test slide 2\nWith multiple lines'
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/generate-ppt',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`\nStatus: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(body);
      console.log('\nResponse:', JSON.stringify(result, null, 2));
      
      if (result.success && result.downloadUrl) {
        console.log(`\n✅ PPT generated successfully!`);
        console.log(`📥 Download URL: http://localhost:3001${result.downloadUrl}`);
        console.log(`📊 Slides: ${result.slides_count}`);
        console.log(`📦 File: ${result.filename}`);
      } else {
        console.log(`\n❌ Error: ${result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log('\nRaw response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

console.log('📤 Sending PPT generation request...');
req.write(data);
req.end();
