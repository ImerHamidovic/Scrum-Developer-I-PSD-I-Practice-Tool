const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { parseQuestions } = require('./parser');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_FILE = path.join(__dirname, 'questions.json');

// Enable gzip compression for all responses
app.use(compression());

// Serve static files with caching headers
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true
}));

// Serve images from the parent directory's images folder
app.use('/images', express.static(path.join(__dirname, '..', 'images'), {
    maxAge: '1d'
}));

// API Endpoint to get questions
app.get('/api/questions', (req, res) => {
    const force = req.query.force === 'true';

    if (!force && fs.existsSync(CACHE_FILE)) {
        console.log('Serving questions from cache...');
        try {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            const questions = JSON.parse(data);
            // Set cache headers for API response
            res.set('Cache-Control', 'public, max-age=3600');
            return res.json(questions);
        } catch (err) {
            console.error('Error reading cache file, falling back to parsing:', err);
        }
    }

    console.log('Parsing questions from README...');
    const questions = parseQuestions();

    // Save to cache
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(questions, null, 2));
        console.log('Questions cached to questions.json');
    } catch (err) {
        console.error('Error writing cache file:', err);
    }

    res.json(questions);
});

// Fallback to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Press Ctrl+C to stop.`);
});
