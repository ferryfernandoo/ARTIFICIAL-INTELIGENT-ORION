// Quick search for latest KRL news
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

async function searchKRLNews() {
  const SERPAPI_KEY = '3dcea72b423f7514a9428d398e9f42cd5d7b9004928fb8212f3694342f61133a';
  
  const searchParams = new URLSearchParams({
    api_key: SERPAPI_KEY,
    engine: 'google_news',
    q: 'kecelakaan KRL terbaru',
    tbm: 'nws',
    gl: 'id',
    num: 10
  });

  const url = 'https://serpapi.com/search.json?' + searchParams;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('\n📰 BERITA KRL TERBARU');
    console.log('='.repeat(70));
    console.log(`Tanggal: ${new Date().toLocaleString('id-ID')}`);
    console.log('='.repeat(70));
    
    if (data.news && data.news.length > 0) {
      data.news.slice(0, 8).forEach((item, idx) => {
        console.log(`\n${idx + 1}. ${item.title}`);
        console.log(`   📍 ${item.source}`);
        console.log(`   ⏰ ${item.date}`);
        console.log(`   📝 ${item.snippet?.substring(0, 150)}...`);
        console.log(`   🔗 ${item.link}`);
      });
      
      console.log('\n' + '='.repeat(70));
      console.log(`✅ Total berita ditemukan: ${data.news.length}`);
      console.log(`⏱️  Search time: ${data.search_metadata?.total_time_taken || 'N/A'}s`);
    } else {
      console.log('❌ Tidak ada berita terbaru ditemukan');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

searchKRLNews();
