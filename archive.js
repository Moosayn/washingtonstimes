const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const archiveFolder = "offline-news";
if (!fs.existsSync(archiveFolder)) fs.mkdirSync(archiveFolder);

async function saveArticles() {
  console.log("Building personal offline archive...");
  console.log("Launching browser...");
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log("Fetching sitemap...");
  await page.goto("https://www.washingtontimes.com/news_sitemap.xml", { waitUntil: 'networkidle2' });
  const sitemapContent = await page.content();
  
  const urls = sitemapContent.match(/<loc>(.*?)<\/loc>/g)
    .map(x => x.replace("<loc>", "").replace("</loc>", ""))
    .slice(0, 50); // Limit to 50 articles for safety

  console.log(`Found ${urls.length} articles for offline backup`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      console.log(`Saving ${i + 1}/${urls.length}: ${url.split('/').pop()}`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000)); // Wait for dynamic content
      
      const html = await page.content();
      const $ = cheerio.load(html);

      const title = $("h1").first().text().trim() || $('meta[property="og:title"]').attr('content') || "Article";
      const date = $("meta[property='article:published_time']").attr("content")?.slice(0,10) || "";
      const author = $(".author-name").text().trim() || $('meta[name="author"]').attr('content') || "Staff";
      const content = $("#article-body").text().trim() || $(".article-text").text().trim() || $(".bigtext").text().trim() || "";

      const safeName = url.split("/").pop() || i;
      const filePath = path.join(archiveFolder, safeName + ".html");

      const outputHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;margin:40px auto;max-width:800px;line-height:1.8;color:#333}
h1{font-size:2.5em;margin-bottom:0.2em}
.meta{color:#666;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:20px}
.content{font-size:1.1em}
</style>
</head><body>
<h1>${title}</h1>
<div class="meta"><strong>${author}</strong> • ${date}</div>
<div class="content"><pre style="white-space:pre-wrap;font-family:Georgia,serif">${content}</pre></div>
<hr><small>Source: <a href="${url}">${url}</a></small>
</body></html>`;

      fs.writeFileSync(filePath, outputHtml);
      console.log(`✓ Archived: ${safeName}`);
      
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000)); // Random delay 2-4 seconds
    } catch (e) {
      console.log(`✗ Skipped: ${e.message}`);
    }
  }
  
  await browser.close();
  console.log("\n✓ Offline archive complete! All files in folder: offline-news");
}

saveArticles();
