const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const ADMIN_URL = "https://www.washingtonstimes.com/admin-dashboard-secure-x9k2p7q";
const SITEMAP_URL = "https://www.washingtontimes.com/news_sitemap.xml";

async function uploadArticlesToCMS() {
  console.log("Starting article upload to CMS...");
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log("Fetching sitemap...");
  await page.goto(SITEMAP_URL, { waitUntil: 'networkidle2' });
  const sitemapContent = await page.content();
  
  const urls = sitemapContent.match(/<loc>(.*?)<\/loc>/g)
    .map(x => x.replace("<loc>", "").replace("</loc>", ""))
    .slice(0, 20); // Limit to 20 articles

  console.log(`Found ${urls.length} articles to upload`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      console.log(`\nProcessing ${i + 1}/${urls.length}: ${url.split('/').pop()}`);
      
      // Fetch article content
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
      
      const articleData = await page.evaluate(() => {
        const title = document.querySelector("h1")?.innerText?.trim() || 
                     document.querySelector('meta[property="og:title"]')?.content || "Article";
        const date = document.querySelector("meta[property='article:published_time']")?.content?.slice(0,10) || "";
        const author = document.querySelector(".author-name")?.innerText?.trim() || 
                      document.querySelector('meta[name="author"]')?.content || "Staff Writer";
        
        // Get article content
        let content = "";
        const articleBody = document.querySelector("#article-body") || 
                           document.querySelector(".article-text") || 
                           document.querySelector(".bigtext");
        
        if (articleBody) {
          // Convert to markdown-style format
          const paragraphs = Array.from(articleBody.querySelectorAll("p"));
          content = paragraphs.map(p => p.innerText.trim()).filter(t => t).join("\n\n");
        }
        
        // If still no content, try getting all text from article body
        if (!content && articleBody) {
          content = articleBody.innerText.trim();
        }
        
        // Last resort - get meta description
        if (!content || content.length < 50) {
          content = document.querySelector('meta[property="og:description"]')?.content || 
                   document.querySelector('meta[name="description"]')?.content || "";
        }
        
        // Try to get category from URL or meta
        const urlParts = window.location.pathname.split('/').filter(x => x);
        let category = "Politics"; // Default
        
        // Map common sections to categories
        if (urlParts[0]) {
          const section = urlParts[0].toLowerCase();
          if (section.includes('world')) category = "World";
          else if (section.includes('business') || section.includes('economy')) category = "Business";
          else if (section.includes('tech')) category = "Technology";
          else if (section.includes('sport')) category = "Sports";
          else if (section.includes('entertain')) category = "Entertainment";
        }
        
        // Get image
        const image = document.querySelector('meta[property="og:image"]')?.content || "";
        
        return { title, author, content, category, image };
      });

      if (!articleData.content || articleData.content.length < 50) {
        console.log("⚠ Skipped: Content too short or missing");
        console.log(`  Content length: ${articleData.content?.length || 0} characters`);
        continue;
      }

      console.log(`  Title: ${articleData.title.substring(0, 60)}...`);
      console.log(`  Category: ${articleData.category}`);
      console.log(`  Author: ${articleData.author}`);
      
      // Navigate to admin new article page
      await page.goto(`${ADMIN_URL}/new`, { waitUntil: 'networkidle2' });
      
      // Fill in the form - using select for category instead of input
      await page.type('#title', articleData.title);
      await page.select('#category', articleData.category);
      await page.type('textarea[name="content"]', articleData.content);
      await page.type('#author', articleData.author);
      
      // Submit the form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('button[type="submit"]')
      ]);
      
      console.log(`✓ Uploaded successfully`);
      
      // Random delay to avoid overwhelming the server
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
      
    } catch (e) {
      console.log(`✗ Failed: ${e.message}`);
    }
  }
  
  await browser.close();
  console.log("\n✓ Upload complete! Check your admin panel.");
}

uploadArticlesToCMS();
