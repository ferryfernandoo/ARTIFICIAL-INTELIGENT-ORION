const data = JSON.stringify({
  messages: [
    { role: "user", content: "berapa harga bitcoin terbaru?" }
  ]
});

fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: data
})
  .then(res => res.json())
  .then(result => {
    console.log('✓ Response received');
    console.log('Success:', result.success);
    console.log('Error:', result.error);
    if (result.reply) {
      console.log('Reply preview:', result.reply.substring(0, 150) + '...');
    }
  })
  .catch(e => console.error('Error:', e.message));

