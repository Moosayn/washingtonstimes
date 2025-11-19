const Parser = require('rss-parser');
const axios = require('axios');

const RSS_URL = 'https://www.washingtontimes.com/rss/headlines/news/';
const CMS_URL = 'https://www.washingtonstimes.com/admin-dashboard-secure-x9k2p7q/article';

async function uploadFromRSS() {
  console.log("Fetching articles from RSS feed...");
  
  const parser = new Parser();
  const feed = await parser.parseURL(RSS_URL);
  
  console.log(`Found ${feed.items.length} articles in RSS feed`);
  console.log(`Uploading first 20 to your CMS...\n`);
  
  const articles = feed.items.slice(0, 20);
  
  for (let i = 0; i < articles.length; i++) {
    const item = articles[i];
    
    try {
      console.log(`Processing ${i + 1}/${articles.length}: ${item.title}`);
      
      const articleData = {
        title: item.title,
        category: 'Politics', // RSS doesn't provide category, defaulting
        content: item.contentSnippet || item.description || item.content || '',
        author: item.creator || 'The Washington Times',
        image: item.enclosure?.url || ''
      };
      
      // Create form data
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('title', articleData.title);
      formData.append('category', articleData.category);
      formData.append('content', articleData.content);
      formData.append('author', articleData.author);
      
      // Submit to your CMS
      const response = await axios.post(CMS_URL, formData, {
        headers: formData.getHeaders(),
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      console.log(`✓ Uploaded: ${articleData.title.substring(0, 60)}...`);
      
      // Delay between uploads
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (e) {
      console.log(`✗ Failed: ${e.message}`);
    }
  }
  
  console.log("\n✓ RSS upload complete! Check your website.");
}

uploadFromRSS();
