import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { connectDB } from './db/connection.js';
import { 
    initDb, 
    readData, 
    writeData, 
    verifyPassword, 
    generateNewHash 
} from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting state
const rateLimitBuckets = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// Generic rate limiter factory
function createRateLimiter(maxAttempts) {
    return function rateLimit(req, res, next) {
        const ip = req.ip || req.connection.remoteAddress;
        const key = `${ip}:${req.path}`;
        const now = Date.now();

        if (!rateLimitBuckets.has(key)) {
            rateLimitBuckets.set(key, []);
        }

        let attempts = rateLimitBuckets.get(key);
        attempts = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
        rateLimitBuckets.set(key, attempts);

        if (attempts.length >= maxAttempts) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests. Please try again later.'
            });
        }

        attempts.push(now);
        next();
    };
}

// Strict CORS Policy Setup (S4)
const allowedOrigins = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://[::1]:5000',
    'http://localhost:5001',
    'http://127.0.0.1:5001',
    'http://[::1]:5001',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000'
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no Origin (same-origin browser requests, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            console.warn(`\x1b[33mCORS Warn:\x1b[0m Access denied for origin: \x1b[31m${origin}\x1b[0m`);
            const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Allows large base64 image uploads

// Security Headers Middleware (S3)
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https://images.unsplash.com; connect-src 'self'; frame-ancestors 'none';"
    );
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Custom request logging middleware (premium look)
app.use((req, res, next) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[\x1b[36m${timestamp}\x1b[0m] \x1b[35m${req.method}\x1b[0m ${req.url}`);
    next();
});

// Serve frontend static assets from public/ folder without caching for development
app.use(express.static('public', { maxAge: 0 }));

// Admin shorthand redirect
app.get('/admin', (req, res) => {
    res.redirect('/admin.html');
});

// Favicon handler
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.resolve('public', 'favicon.ico'), (err) => {
        if (err) {
            res.status(204).end();
        }
    });
});

/* ==========================================================================
   AUTHENTICATION MIDDLEWARE
   ========================================================================== */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access Denied: Authentication Token Missing.' });
    }

    try {
        const auth = await readData('auth');
        const activeToken = auth.tokens.find(t => t.token === token);

        if (!activeToken) {
            return res.status(403).json({ success: false, message: 'Access Denied: Session Expired or Token Invalid.' });
        }

        // Check if token has expired
        if (new Date(activeToken.expiry) < new Date()) {
            // Clean up expired token
            auth.tokens = auth.tokens.filter(t => t.token !== token);
            await writeData('auth', auth);
            return res.status(403).json({ success: false, message: 'Access Denied: Session Expired.' });
        }

        // Token is valid, pass control
        req.adminSession = activeToken;
        next();
    } catch (error) {
        console.error('Authentication Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error during auth.' });
    }
}

/* ==========================================================================
   IMAGE UPLOAD PROCESSOR (BASE64 DECODER)
   ========================================================================== */
async function saveBase64Image(base64Str) {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
        return base64Str; // Return unchanged if not base64 (e.g. absolute URL string)
    }

    try {
        // Extract content type and data
        const matches = base64Str.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid Base64 string format');
        }

        const mimeType = matches[1];
        const dataBuffer = Buffer.from(matches[2], 'base64');
        
        // Determine file extension
        let extension = 'png';
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
            extension = 'jpg';
        } else if (mimeType.includes('gif')) {
            extension = 'gif';
        } else if (mimeType.includes('webp')) {
            extension = 'webp';
        }

        // Generate dynamic name
        const fileName = `project-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
        const relativePath = `/uploads/${fileName}`;
        const absolutePath = path.join('public', 'uploads', fileName);

        // Ensure directories exist
        await fs.mkdir(path.join('public', 'uploads'), { recursive: true });
        
        // Write file
        await fs.writeFile(absolutePath, dataBuffer);
        
        console.log(`Saved physical image file: \x1b[32m${absolutePath}\x1b[0m`);
        return relativePath; // Stored path referencing back to the server directory
    } catch (error) {
        console.error('Failed to decode Base64 image:', error);
        return 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80'; // fallback generic circuit
    }
}

// Admin Security Status Check
app.get('/api/auth/status', async (req, res) => {
    try {
        const auth = await readData('auth');
        return res.json({ passcodeCustomized: true });
    } catch (error) {
        return res.json({ passcodeCustomized: true });
    }
});

// Admin Login
app.post('/api/auth/login', createRateLimiter(5), async (req, res) => {
    const { passcode } = req.body;
    
    if (!passcode) {
        return res.status(400).json({ success: false, message: 'Passcode is required.' });
    }

    try {
        const auth = await readData('auth');
        const isValid = verifyPassword(passcode, auth.salt, auth.hash);

        if (isValid) {
            // Generate session token
            const token = crypto.randomBytes(32).toString('hex');
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + 24); // Token valid for 24 hours

            auth.tokens.push({ token, expiry: expiry.toISOString() });
            await writeData('auth', auth);

            return res.json({ success: true, token });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid passcode. Access Denied.' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ success: false, message: 'Server error during authentication.' });
    }
});

// Admin Passcode Update
app.post('/api/auth/change-passcode', authenticateToken, async (req, res) => {
    const { currentPasscode, newPasscode } = req.body;

    if (!currentPasscode || !newPasscode) {
        return res.status(400).json({ success: false, message: 'Current and new passcodes are required.' });
    }

    try {
        const auth = await readData('auth');
        const isValid = verifyPassword(currentPasscode, auth.salt, auth.hash);

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Incorrect current passcode.' });
        }

        // Set new passcode credentials
        const credentials = generateNewHash(newPasscode);
        auth.salt = credentials.salt;
        auth.hash = credentials.hash;
        auth.tokens = []; // Revoke all other active sessions for security

        await writeData('auth', auth);
        return res.json({ success: true, message: 'Passcode updated successfully. Session updated.' });
    } catch (error) {
        console.error('Password Update Error:', error);
        return res.status(500).json({ success: false, message: 'Server error during passcode update.' });
    }
});

/* ==========================================================================
   REST ENDPOINTS: PROJECTS GALLERY
   ========================================================================== */

// Fetch Projects
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await readData('projects');
        return res.json(projects);
    } catch (error) {
        console.error('Fetch Projects Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve project database.' });
    }
});

// Add Project Card
app.post('/api/projects', authenticateToken, async (req, res) => {
    const { title, category, tags, description, image, showOnHomepage } = req.body;

    if (!title || !category || !tags || !description) {
        return res.status(400).json({ success: false, message: 'Missing required project fields.' });
    }

    try {
        const projects = await readData('projects');
        
        // Decode & physicalize image file
        const imagePath = await saveBase64Image(image);

        const newProject = {
            id: `proj-${Date.now()}`,
            title,
            category,
            tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()),
            description,
            image: imagePath,
            showOnHomepage: showOnHomepage !== undefined ? showOnHomepage : true
        };

        projects.unshift(newProject);
        await writeData('projects', projects);

        return res.status(201).json({ success: true, project: newProject });
    } catch (error) {
        console.error('Add Project Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create new project.' });
    }
});

// Modify Project Card
app.put('/api/projects/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { title, category, tags, description, image, showOnHomepage } = req.body;

    try {
        const projects = await readData('projects');
        const index = projects.findIndex(p => p.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        // Process image upload if modified
        const imagePath = await saveBase64Image(image);

        projects[index] = {
            id,
            title: title || projects[index].title,
            category: category || projects[index].category,
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : projects[index].tags,
            description: description || projects[index].description,
            image: imagePath || projects[index].image,
            showOnHomepage: showOnHomepage !== undefined ? showOnHomepage : projects[index].showOnHomepage
        };

        await writeData('projects', projects);
        return res.json({ success: true, project: projects[index] });
    } catch (error) {
        console.error('Modify Project Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update project.' });
    }
});

// Delete Project Card
app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const projects = await readData('projects');
        const filtered = projects.filter(p => p.id !== id);

        if (projects.length === filtered.length) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        await writeData('projects', filtered);
        return res.json({ success: true, message: 'Project deleted successfully.' });
    } catch (error) {
        console.error('Delete Project Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to remove project.' });
    }
});

/* ==========================================================================
   REST ENDPOINTS: STORE & KITS
   ========================================================================== */

// Fetch Store Products
app.get('/api/store', async (req, res) => {
    try {
        const store = await readData('store');
        return res.json(store);
    } catch (error) {
        console.error('Fetch Store Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve store products.' });
    }
});

// Add Store Product
app.post('/api/store', authenticateToken, async (req, res) => {
    const { title, price, originalPrice, category, stock, tags, description, includedComponents, image } = req.body;

    if (!title || !price || !category || stock === undefined || !description) {
        return res.status(400).json({ success: false, message: 'Missing required store product fields.' });
    }

    try {
        const store = await readData('store');
        
        // Decode & physicalize image file
        const imagePath = await saveBase64Image(image);

        const newProduct = {
            id: `kit-${Date.now()}`,
            title,
            price,
            originalPrice: originalPrice || '',
            category,
            stock: parseInt(stock, 10) || 0,
            tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()),
            description,
            includedComponents: includedComponents || '',
            image: imagePath
        };

        store.unshift(newProduct);
        await writeData('store', store);

        return res.status(201).json({ success: true, product: newProduct });
    } catch (error) {
        console.error('Add Store Product Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create store product.' });
    }
});

// Modify Store Product
app.put('/api/store/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { title, price, originalPrice, category, stock, tags, description, includedComponents, image } = req.body;

    try {
        const store = await readData('store');
        const index = store.findIndex(p => p.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        // Process image upload if modified
        const imagePath = await saveBase64Image(image);

        store[index] = {
            id,
            title: title || store[index].title,
            price: price || store[index].price,
            originalPrice: originalPrice !== undefined ? originalPrice : store[index].originalPrice,
            category: category || store[index].category,
            stock: stock !== undefined ? parseInt(stock, 10) : store[index].stock,
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : store[index].tags,
            description: description || store[index].description,
            includedComponents: includedComponents !== undefined ? includedComponents : store[index].includedComponents,
            image: imagePath || store[index].image
        };

        await writeData('store', store);
        return res.json({ success: true, product: store[index] });
    } catch (error) {
        console.error('Modify Store Product Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update store product.' });
    }
});

// Delete Store Product
app.delete('/api/store/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const store = await readData('store');
        const filtered = store.filter(p => p.id !== id);

        if (store.length === filtered.length) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        await writeData('store', filtered);
        return res.json({ success: true, message: 'Store product deleted successfully.' });
    } catch (error) {
        console.error('Delete Store Product Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to remove store product.' });
    }
});

/* ==========================================================================
   REST ENDPOINTS: PROFILE & SETTINGS
   ========================================================================== */

// Fetch Settings Profile
app.get('/api/profile', async (req, res) => {
    try {
        const profile = await readData('profile');
        return res.json(profile);
    } catch (error) {
        console.error('Fetch Profile Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve profile settings.' });
    }
});

// Update Profile settings
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const currentProfile = await readData('profile');
        const updatedProfile = { ...currentProfile, ...req.body };

        await writeData('profile', updatedProfile);
        return res.json({ success: true, profile: updatedProfile });
    } catch (error) {
        console.error('Update Profile Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update profile settings.' });
    }
});

/* ==========================================================================
   REST ENDPOINTS: CUSTOMER INQUIRIES
   ========================================================================== */

// Fetch Inquiries Inbox list
app.get('/api/inquiries', authenticateToken, async (req, res) => {
    try {
        const inquiries = await readData('inquiries');
        return res.json(inquiries);
    } catch (error) {
        console.error('Fetch Inquiries Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve customer inquiries.' });
    }
});

// Add New Inquiry
app.post('/api/inquiries', createRateLimiter(10), async (req, res) => {
    const { name, phone, email, category, project, message } = req.body;

    if (!name || (!phone && !email) || !message) {
        return res.status(400).json({ success: false, message: 'Missing required customer details: name, message, and at least one contact channel (phone or email) are required.' });
    }

    try {
        const inquiries = await readData('inquiries');
        
        const newInquiry = {
            id: `inq-${Date.now()}`,
            date: new Date().toLocaleString(),
            name,
            phone,
            email,
            category: category || 'Inquiry Card',
            project: project || '',
            message
        };

        inquiries.unshift(newInquiry);
        await writeData('inquiries', inquiries);

        return res.status(201).json({ success: true, inquiry: newInquiry });
    } catch (error) {
        console.error('Add Inquiry Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to process inquiry submission.' });
    }
});

// Delete Single Inquiry Card
app.delete('/api/inquiries/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const inquiries = await readData('inquiries');
        const filtered = inquiries.filter(i => i.id !== id);

        if (inquiries.length === filtered.length) {
            return res.status(404).json({ success: false, message: 'Inquiry item not found.' });
        }

        await writeData('inquiries', filtered);
        return res.json({ success: true, message: 'Inquiry record removed.' });
    } catch (error) {
        console.error('Delete Inquiry Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete inquiry.' });
    }
});

// Clear Entire Inquiries Inbox list
app.post('/api/inquiries/clear', authenticateToken, async (req, res) => {
    try {
        await writeData('inquiries', []);
        return res.json({ success: true, message: 'Inquiries database cleared successfully.' });
    } catch (error) {
        console.error('Clear Inbox Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to clear inquiries.' });
    }
});

/* ==========================================================================
   REST ENDPOINTS: CUSTOMER AUTH & PROFILES
   ========================================================================== */

// Check customer auth / check by phone number
app.post('/api/customer/auth', createRateLimiter(10), async (req, res) => {
    let { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    
    // Normalize phone number (remove spaces and special characters for strict matches)
    const normalizedPhone = phone.replace(/\D/g, '');

    try {
        const customers = await readData('customers');
        const customer = customers.find(c => c.phone.replace(/\D/g, '') === normalizedPhone);

        if (customer) {
            // Return only necessary fields, not full PII
            return res.json({
                success: true,
                exists: true,
                customer: {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                    address: customer.address,
                    dateJoined: customer.dateJoined
                }
            });
        } else {
            return res.json({ success: true, exists: false, message: 'Customer not registered.' });
        }
    } catch (error) {
        console.error('Customer Auth Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error during lookup.' });
    }
});

// Register customer
app.post('/api/customer/register', createRateLimiter(5), async (req, res) => {
    const { name, phone, address } = req.body;

    if (!name || !phone || !address) {
        return res.status(400).json({ success: false, message: 'Missing required customer details: name, phone, and address are required.' });
    }

    try {
        const customers = await readData('customers');
        const normalizedPhone = phone.replace(/\D/g, '');
        
        // Check if phone number already exists
        const exists = customers.some(c => c.phone.replace(/\D/g, '') === normalizedPhone);
        if (exists) {
            return res.status(400).json({ success: false, message: 'A customer with this phone number is already registered.' });
        }

        const newCustomer = {
            id: `cust-${Date.now()}`,
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            dateJoined: new Date().toLocaleDateString()
        };

        customers.unshift(newCustomer);
        await writeData('customers', customers);

        return res.status(201).json({ success: true, customer: newCustomer });
    } catch (error) {
        console.error('Customer Register Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to complete customer registration.' });
    }
});

// Update customer profile
app.put('/api/customer/profile', createRateLimiter(10), async (req, res) => {
    const { name, phone, address } = req.body;

    if (!phone || !name || !address) {
        return res.status(400).json({ success: false, message: 'Missing fields: phone, name, and address are required.' });
    }

    try {
        const customers = await readData('customers');
        const normalizedPhone = phone.replace(/\D/g, '');
        const index = customers.findIndex(c => c.phone.replace(/\D/g, '') === normalizedPhone);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Customer profile not found.' });
        }

        customers[index] = {
            ...customers[index],
            name: name.trim(),
            address: address.trim()
        };

        await writeData('customers', customers);
        return res.json({ success: true, customer: customers[index] });
    } catch (error) {
        console.error('Customer Profile Update Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
});

/* ==========================================================================
    CUSTOM 404 HANDLER
    ========================================================================== */
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'API endpoint not found.' });
    }
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - Page Not Found | MK Tech</title>
        <link rel="stylesheet" href="/style.css">
        <style>
            body { display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 20px; }
            .error-container { max-width: 500px; }
            .error-code { font-size: 6rem; font-weight: 800; color: var(--accent-cyan); line-height: 1; margin-bottom: 8px; }
            .error-title { font-size: 1.5rem; margin-bottom: 12px; }
            .error-text { color: var(--text-secondary); margin-bottom: 32px; }
            .btn { display: inline-flex; align-items: center; gap: 8px; }
        </style>
        </head>
        <body class="dark-theme">
            <div class="error-container">
                <div class="error-code">404</div>
                <h1 class="error-title">Page Not Found</h1>
                <p class="error-text">The page you are looking for does not exist or has been moved.</p>
                <a href="/" class="btn btn-primary"><i class="fa-solid fa-house"></i> Back to Home</a>
            </div>
        </body>
        </html>
    `);
});

/* ==========================================================================
    INITIALIZE SERVER
    ========================================================================== */
async function startServer() {
    try {
        await connectDB();
        await initDb();
        console.log('MongoDB collections seeded successfully.');
        
        app.listen(PORT, () => {
            console.log(`\n\x1b[32m===================================================\x1b[0m`);
            console.log(`  \x1b[36mMK TECH BACKEND SERVER RUNNING SUCCESSFULLY\x1b[0m`);
            console.log(`  \x1b[33mURL:\x1b[0m http://localhost:${PORT}`);
            console.log(`\x1b[32m===================================================\x1b[0m\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
