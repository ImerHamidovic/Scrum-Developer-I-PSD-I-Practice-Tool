# PSD-I Practice Tool Documentation

## Overview

The PSD-I Practice Tool is an interactive web-based application designed to help you prepare for the Professional Scrum Developer I (PSD-I) certification exam. It parses questions from the repository's README and provides multiple study modes.

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Setup Steps

```bash
# Navigate to the practice tool directory
cd psd1-practice-tool

# Install dependencies
npm install

# Start the development server
npm start
```

The application will start on `http://localhost:3000`

## Features

### 🎯 Practice Mode

Perfect for learning and studying:
- **Instant Feedback**: Check your answers immediately
- **Bookmarking**: Save difficult questions for later review
- **Jump to Question**: Navigate directly to any question number
- **Progress Indication**: See which questions you've answered
- **No Time Pressure**: Study at your own pace

**How to use:**
1. Click "Practice Mode" from the main menu
2. Read the question and select your answer(s)
3. Click "Check Answer" to see if you're correct
4. Green = Correct, Red = Incorrect
5. Use navigation buttons or arrow keys to move between questions
6. Click the bookmark icon to save questions

### ⏱️ Exam Mode

Simulates the real exam experience:
- **Time Limit**: 60 minutes countdown timer
- **Random Question Order**: Questions are shuffled
- **Exam-like Interface**: No immediate feedback
- **Results Summary**: Detailed performance breakdown at the end
- **Pass/Fail Indicator**: 85% passing threshold (like the real exam)

**How to use:**
1. Click "Exam Mode" from the main menu
2. Answer all questions before time runs out
3. Use navigation buttons to move between questions
4. Click "Submit Exam" when ready or wait for timer to expire
5. Review your results and see which questions you missed

### 🔖 Bookmarks Mode

Review your saved questions:
- Access all bookmarked questions in one place
- Perfect for focused review of challenging topics
- Same interface as Practice Mode
- Bookmarks persist in browser localStorage

### ⌨️ Keyboard Shortcuts

- **Enter/Space**: Check answer (Practice Mode) or navigate to next question
- **Backspace/Delete**: Previous question
- **Alt**: Check answer (Practice Mode only)

## Architecture

### File Structure

```
psd1-practice-tool/
├── server.js           # Express server
├── parser.js           # README parser logic
├── package.json        # Dependencies
├── start.sh           # Startup script
├── questions.json     # Cached questions (auto-generated)
└── public/
    ├── index.html     # Main HTML file
    ├── app.js         # Client-side JavaScript
    ├── style.css      # Main styles
    ├── bookmark.css   # Bookmark-specific styles
    ├── input.css      # Input field styles
    └── scroll.css     # Scrollbar styles
```

### How It Works

1. **Parser** (`parser.js`): Reads the parent README.md, extracts questions, options, and correct answers
2. **Server** (`server.js`): Serves the web application and provides `/api/questions` endpoint
3. **Caching**: First parse creates `questions.json` for faster subsequent loads
4. **Client** (`app.js`): Manages UI state, user interactions, and localStorage for bookmarks

### Question Format

Questions are parsed from markdown with this structure:

```markdown
### Question text here?

- [ ] Incorrect option
- [x] Correct option
- [x] Another correct option
- [ ] Incorrect option
```

The parser identifies:
- Questions starting with `###`
- Options with `- [ ]` (incorrect) or `- [x]` (correct)
- Expected number of correct answers per question

## API Endpoints

### `GET /api/questions`

Returns all parsed questions in JSON format.

**Query Parameters:**
- `force=true`: Force re-parse from README (bypass cache)

**Response Format:**
```json
[
  {
    "id": 1,
    "question": "When can Product Backlog Refinement occur?",
    "options": [
      { "text": "Option 1", "isCorrect": false },
      { "text": "Option 2", "isCorrect": true }
    ],
    "expectedAnswers": 1
  }
]
```

## Configuration

### Port Configuration

Default port is `3000`. To change:

```javascript
// In server.js
const PORT = process.env.PORT || 3000;
```

Then start with:
```bash
PORT=8080 npm start
```

### Exam Settings

Customize exam parameters in `public/app.js`:

```javascript
const EXAM_DURATION_MINUTES = 60;  // Change exam duration
// Pass threshold calculated in finishExam() function
```

## Data Persistence

### LocalStorage Usage

The application uses browser localStorage for:
- **Bookmarks**: Key `psd1_bookmarks`, stores array of question IDs
- **No other data**: User answers are session-only for privacy

### Clearing Data

To reset bookmarks:
```javascript
// In browser console:
localStorage.removeItem('psd1_bookmarks');
```

## Troubleshooting

### Questions Not Loading

1. Check that README.md exists in parent directory
2. Verify README format matches expected structure
3. Try force reload: `http://localhost:3000/api/questions?force=true`
4. Check server console for parsing errors

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Bookmarks Not Persisting

- Check browser localStorage is enabled
- Try a different browser
- Check for private/incognito mode (may restrict storage)

## Development

### Adding New Features

1. **Client-side changes**: Edit `public/app.js` and CSS files
2. **Server-side changes**: Edit `server.js`
3. **Parser updates**: Modify `parser.js`
4. Restart server to see changes

### Debug Mode

Add console logging in `parser.js`:

```javascript
console.log('Parsed questions:', questions.length);
```

### Testing Parser

```javascript
// In parser.js
const { parseQuestions } = require('./parser');
const questions = parseQuestions();
console.log(JSON.stringify(questions, null, 2));
```

## Future Enhancements

Potential improvements:
- [ ] User accounts and cloud sync
- [ ] Detailed analytics and study recommendations
- [ ] Mobile app version
- [ ] Explanations for each answer
- [ ] Custom exam duration
- [ ] Export results as PDF
- [ ] Dark mode
- [ ] Multiple language support

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

## License

This project is open source and available under the same license as the parent repository.

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Contact: [Imer Hamidovic](https://github.com/ImerHamidovic)

---

**Happy studying and good luck on your PSD-I exam! 🎓**
