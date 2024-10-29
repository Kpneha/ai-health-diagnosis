const express = require('express');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const session = require('express-session');
const pool = require('./db');  // Import the database pool
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your_secret_key',  // Replace with a strong secret key
    resave: false,
    saveUninitialized: true
}));
// Routes to serve the HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/sendToOllama', async (req, res) => {
    const data = req.body.healthConcerns;
    console.log(data);
    const prompt = `
      You are a healthcare AI chatbot that will answer the questions that are asked by the user just like a doctor.
      You are to analyze the question and then respond according to that.
      If symptoms are asked, do a proper evaluation of the question and then answer accordingly.
      You must answer in a professional way where there should not be anu emojis and funny comments.
      The asnwer must be in a text format and not in json format.There shoudl not be new lines or spaces in the answer section.
      The answer must not be in a json format.
      ` + data;

    const payload = {
        model: "gemma2",
        prompt: prompt,
        format: "json",
        options: {
            temperature: 0.5,
            num_ctx: 4096,
            num_predict: 1000,
            top_k: 40,
            top_p: 0.3
        },
        stream: false
    };

    try {
        // Use axios to make the POST request
        const ollamaResponse = await axios.post('http://localhost:11434/api/generate', payload, {
            headers: { "Content-Type": "application/json" }
        });

        const modelResponse = ollamaResponse.data.response ? ollamaResponse.data.response.trim() : "No response received.";
        console.log(modelResponse)
        res.json({ response: modelResponse });
    } catch (error) {
        console.error("Error in Ollama API request:", error);
        res.status(500).json({ error: "An error occurred while processing the question." });
    }
});

// Additional routes
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});
app.get('/feedback', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'feedback.html'));
});
app.get('/assistance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'assistance.html'));
});

// Registration Route
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    // Log email and password to verify they are received correctly
    console.log("Email:", email, "Password:", password);

    try {
        // Check if password is provided and meets length requirement
        if (!password || password.length < 8) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Register - Health Diagnosis</title>
                    <link rel="stylesheet" href="css/styles.css">
                </head>
                <body class="signup-bg">
                    <div class="form-container">
                        <h2>Register</h2>
                        <form action="/register" method="POST">
                            <label for="email">Email:</label>
                            <input type="email" id="email" name="email" required value="${email}">
                            
                            <label for="password">Password:</label>
                            <input type="password" id="password" name="password" required>
                            
                            <span style="color: red;">Password must be at least 8 characters long.</span>
                            <button type="submit" class="btn">Sign Up</button>
                        </form>
                        <p>Already have an account? <a href="login.html">Log in here</a>.</p>
                    </div>
                </body>
                </html>
            `);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
            [email, hashedPassword]
        );
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registering user' });
    }
});



// Login Route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        req.session.userEmail = email;  // Store email in the session
        res.redirect('/');  // Redirect to the home page or dashboard
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error logging in' });
    }
});

app.post('/feedback', async (req, res) => {
    const { experience, comments } = req.body;
    const userEmail = req.session.userEmail;  // Assuming email is stored in the session upon login

    try {
        await pool.query(
            'INSERT INTO feedback (user_email, experience, comments) VALUES ($1, $2, $3)',
            [userEmail, experience, comments]
        );
        res.redirect('/');  // Redirect to a thank-you page or back to the home page
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});