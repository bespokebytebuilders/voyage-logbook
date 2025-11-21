// MVP Backend API for Voyage Logbook
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database schema
function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Bucket list items table
        db.run(`CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            why TEXT,
            location TEXT,
            lat REAL,
            lng REAL,
            target_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Action steps table
        db.run(`CREATE TABLE IF NOT EXISTS steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            order_index INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        )`);

        // Create indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_steps_item_id ON steps(item_id)`);
    });
}

// JWT middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if user exists
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                return res.status(400).json({ error: 'Email already exists' });
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Create user
            db.run(
                'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
                [email, passwordHash, name],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to create user' });
                    }

                    // Generate JWT
                    const token = jwt.sign(
                        { id: this.lastID, email, name },
                        JWT_SECRET,
                        { expiresIn: '24h' }
                    );

                    res.json({
                        token,
                        user: { id: this.lastID, email, name }
                    });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Generate JWT
            const token = jwt.sign(
                { id: user.id, email: user.email, name: user.name },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                token,
                user: { id: user.id, email: user.email, name: user.name }
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Items endpoints
app.get('/api/items', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id],
        (err, items) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            // Get steps for each item
            if (items.length === 0) {
                return res.json([]);
            }

            const itemIds = items.map(item => item.id);
            const placeholders = itemIds.map(() => '?').join(',');

            db.all(
                `SELECT * FROM steps WHERE item_id IN (${placeholders}) ORDER BY order_index`,
                itemIds,
                (err, steps) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    // Group steps by item_id
                    const stepsByItem = {};
                    steps.forEach(step => {
                        if (!stepsByItem[step.item_id]) {
                            stepsByItem[step.item_id] = [];
                        }
                        stepsByItem[step.item_id].push({
                            id: step.id.toString(),
                            text: step.text,
                            completed: step.completed === 1,
                            order_index: step.order_index
                        });
                    });

                    // Format items
                    const formattedItems = items.map(item => ({
                        id: item.id.toString(),
                        userId: item.user_id.toString(),
                        title: item.title,
                        why: item.why,
                        location: item.location,
                        targetDate: item.target_date,
                        coordinates: item.lat && item.lng ? {
                            lat: item.lat,
                            lng: item.lng
                        } : null,
                        howSteps: stepsByItem[item.id] || [],
                        createdAt: item.created_at,
                        updatedAt: item.updated_at
                    }));

                    res.json(formattedItems);
                }
            );
        }
    );
});

app.post('/api/items', authenticateToken, (req, res) => {
    try {
        const { title, why, location, targetDate, coordinates, howSteps } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const lat = coordinates?.lat || null;
        const lng = coordinates?.lng || null;

        db.run(
            `INSERT INTO items (user_id, title, why, location, lat, lng, target_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, title, why || null, location || null, lat, lng, targetDate || null],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to create item' });
                }

                const itemId = this.lastID;

                // Insert steps
                if (howSteps && howSteps.length > 0) {
                    const stepValues = howSteps.map((step, index) => 
                        [itemId, step.text, step.completed ? 1 : 0, index]
                    );
                    const stepPlaceholders = stepValues.map(() => '(?, ?, ?, ?)').join(',');
                    const stepParams = stepValues.flat();

                    db.run(
                        `INSERT INTO steps (item_id, text, completed, order_index)
                         VALUES ${stepPlaceholders}`,
                        stepParams,
                        (err) => {
                            if (err) {
                                console.error('Error inserting steps:', err);
                            }
                        }
                    );
                }

                // Return created item
                db.get('SELECT * FROM items WHERE id = ?', [itemId], (err, item) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    db.all('SELECT * FROM steps WHERE item_id = ? ORDER BY order_index', [itemId], (err, steps) => {
                        const formattedItem = {
                            id: item.id.toString(),
                            userId: item.user_id.toString(),
                            title: item.title,
                            why: item.why,
                            location: item.location,
                            targetDate: item.target_date,
                            coordinates: item.lat && item.lng ? {
                                lat: item.lat,
                                lng: item.lng
                            } : null,
                            howSteps: steps.map(s => ({
                                id: s.id.toString(),
                                text: s.text,
                                completed: s.completed === 1,
                                order_index: s.order_index
                            })),
                            createdAt: item.created_at,
                            updatedAt: item.updated_at
                        };

                        res.status(201).json(formattedItem);
                    });
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/items/:id', authenticateToken, (req, res) => {
    try {
        const itemId = req.params.id;
        const { title, why, location, targetDate, coordinates, howSteps } = req.body;

        // Verify ownership
        db.get('SELECT user_id FROM items WHERE id = ?', [itemId], (err, item) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!item) {
                return res.status(404).json({ error: 'Item not found' });
            }
            if (item.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const lat = coordinates?.lat || null;
            const lng = coordinates?.lng || null;

            db.run(
                `UPDATE items 
                 SET title = ?, why = ?, location = ?, lat = ?, lng = ?, target_date = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [title, why || null, location || null, lat, lng, targetDate || null, itemId],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to update item' });
                    }

                    // Delete existing steps and insert new ones
                    db.run('DELETE FROM steps WHERE item_id = ?', [itemId], (err) => {
                        if (err) {
                            console.error('Error deleting steps:', err);
                        }

                        if (howSteps && howSteps.length > 0) {
                            const stepValues = howSteps.map((step, index) => 
                                [itemId, step.text, step.completed ? 1 : 0, index]
                            );
                            const stepPlaceholders = stepValues.map(() => '(?, ?, ?, ?)').join(',');
                            const stepParams = stepValues.flat();

                            db.run(
                                `INSERT INTO steps (item_id, text, completed, order_index)
                                 VALUES ${stepPlaceholders}`,
                                stepParams,
                                (err) => {
                                    if (err) {
                                        console.error('Error inserting steps:', err);
                                    }
                                }
                            );
                        }

                        // Return updated item
                        db.get('SELECT * FROM items WHERE id = ?', [itemId], (err, item) => {
                            if (err) {
                                return res.status(500).json({ error: 'Database error' });
                            }

                            db.all('SELECT * FROM steps WHERE item_id = ? ORDER BY order_index', [itemId], (err, steps) => {
                                const formattedItem = {
                                    id: item.id.toString(),
                                    userId: item.user_id.toString(),
                                    title: item.title,
                                    why: item.why,
                                    location: item.location,
                                    targetDate: item.target_date,
                                    coordinates: item.lat && item.lng ? {
                                        lat: item.lat,
                                        lng: item.lng
                                    } : null,
                                    howSteps: steps.map(s => ({
                                        id: s.id.toString(),
                                        text: s.text,
                                        completed: s.completed === 1,
                                        order_index: s.order_index
                                    })),
                                    createdAt: item.created_at,
                                    updatedAt: item.updated_at
                                };

                                res.json(formattedItem);
                            });
                        });
                    });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/items/:id', authenticateToken, (req, res) => {
    const itemId = req.params.id;

    // Verify ownership
    db.get('SELECT user_id FROM items WHERE id = ?', [itemId], (err, item) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Delete item (steps will be deleted via CASCADE)
        db.run('DELETE FROM items WHERE id = ?', [itemId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete item' });
            }
            res.json({ message: 'Item deleted successfully' });
        });
    });
});

// Step completion toggle
app.put('/api/items/:id/steps/:stepId', authenticateToken, (req, res) => {
    const itemId = req.params.id;
    const stepId = req.params.stepId;

    // Verify item ownership
    db.get('SELECT user_id FROM items WHERE id = ?', [itemId], (err, item) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Toggle step completion
        db.get('SELECT completed FROM steps WHERE id = ? AND item_id = ?', [stepId, itemId], (err, step) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!step) {
                return res.status(404).json({ error: 'Step not found' });
            }

            const newCompleted = step.completed === 1 ? 0 : 1;

            db.run(
                'UPDATE steps SET completed = ? WHERE id = ? AND item_id = ?',
                [newCompleted, stepId, itemId],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to update step' });
                    }

                    res.json({
                        id: stepId,
                        completed: newCompleted === 1
                    });
                }
            );
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

