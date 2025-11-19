const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const slugify = require('slugify');
const { marked } = require('marked');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Initialize data file
const articlesFile = './data/articles.json';
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}
if (!fs.existsSync(articlesFile)) {
  fs.writeFileSync(articlesFile, JSON.stringify([]));
}

// Helper functions
function getArticles() {
  const data = fs.readFileSync(articlesFile, 'utf8');
  return JSON.parse(data);
}

function saveArticles(articles) {
  fs.writeFileSync(articlesFile, JSON.stringify(articles, null, 2));
}

function generateSlug(title) {
  return slugify(title, { lower: true, strict: true });
}

// Routes
app.get('/', async (req, res) => {
  const articles = getArticles().sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Fetch RSS feed
  const parser = new Parser();
  let rssArticles = [];
  try {
    const feed = await parser.parseURL('https://www.washingtontimes.com/rss/headlines/news/');
    rssArticles = feed.items.slice(0, 10).map(item => ({
      title: item.title,
      link: item.link,
      description: item.contentSnippet || item.description,
      author: item.creator || 'The Washington Times',
      date: item.pubDate,
      image: item.enclosure?.url || null
    }));
  } catch (error) {
    console.error('Error fetching RSS:', error);
  }
  
  res.render('index', { articles, rssArticles });
});

app.get('/category/:category', (req, res) => {
  const category = req.params.category;
  const allArticles = getArticles();
  const articles = allArticles.filter(a => a.category.toLowerCase() === category.toLowerCase())
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.render('category', { articles, category });
});

app.get('/article/:slug', (req, res) => {
  const articles = getArticles();
  const article = articles.find(a => a.slug === req.params.slug);
  if (!article) {
    return res.status(404).send('Article not found');
  }
  article.contentHtml = marked(article.content);
  res.render('article', { article });
});

// Admin routes
app.get('/admin-dashboard-secure-x9k2p7q', (req, res) => {
  const articles = getArticles().sort((a, b) => new Date(b.date) - new Date(a.date));
  res.render('admin', { articles });
});

app.get('/admin-dashboard-secure-x9k2p7q/new', (req, res) => {
  res.render('article-form', { article: null });
});

app.get('/admin-dashboard-secure-x9k2p7q/edit/:id', (req, res) => {
  const articles = getArticles();
  const article = articles.find(a => a.id === req.params.id);
  if (!article) {
    return res.status(404).send('Article not found');
  }
  res.render('article-form', { article });
});

app.post('/admin-dashboard-secure-x9k2p7q/article', upload.single('image'), (req, res) => {
  const articles = getArticles();
  const { title, category, content, author, id } = req.body;
  const slug = generateSlug(title);
  
  const articleData = {
    id: id || Date.now().toString(),
    title,
    slug,
    category,
    content,
    author: author || 'Staff Writer',
    date: new Date().toISOString(),
    image: req.file ? '/uploads/' + req.file.filename : (req.body.existingImage || '')
  };

  if (id) {
    const index = articles.findIndex(a => a.id === id);
    if (index !== -1) {
      articleData.date = articles[index].date; // Keep original date
      articles[index] = articleData;
    }
  } else {
    articles.push(articleData);
  }

  saveArticles(articles);
  res.redirect('/admin-dashboard-secure-x9k2p7q');
});

app.post('/admin-dashboard-secure-x9k2p7q/delete/:id', (req, res) => {
  let articles = getArticles();
  articles = articles.filter(a => a.id !== req.params.id);
  saveArticles(articles);
  res.redirect('/admin-dashboard-secure-x9k2p7q');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin-dashboard-secure-x9k2p7q`);
});
