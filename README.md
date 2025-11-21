# Voyage Logbook - MVP Deployment

A bucket list application with maps, goals, and journaling capabilities.

## Project Structure

```
voyage-logbook/
├── server/           # Backend API (Node.js/Express/SQLite)
│   ├── server.js     # Main API server
│   ├── package.json  # Dependencies
│   └── .gitignore    # Excludes database and node_modules
└── www/              # Frontend (Static HTML/CSS/JS)
    ├── index.html    # Main application
    └── js/
        └── api.js    # API client
```

## Quick Start (Local Development)

### Backend Setup

1. Navigate to server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set environment variables (optional for local dev):
   ```bash
   export JWT_SECRET="your-secret-key-here"
   export PORT=3000
   export CORS_ORIGIN="http://localhost:8080"
   ```

4. Start the server:
   ```bash
   npm start
   ```

   The server will:
   - Create `database.sqlite` automatically on first run
   - Initialize all tables
   - Start on port 3000 (or PORT env var)

### Frontend Setup

1. Update API URL in `www/js/api.js`:
   ```javascript
   const API_URL = 'http://localhost:3000/api';
   ```

2. Serve the frontend (any static file server):
   ```bash
   # Using Python
   cd www
   python3 -m http.server 8080

   # Or using Node.js http-server
   npx http-server www -p 8080
   ```

3. Open browser: `http://localhost:8080`

## Production Deployment

### Backend Deployment (Railway or Render)

#### Option 1: Railway

1. Push code to GitHub
2. Go to [Railway](https://railway.app) and create new project
3. Connect your GitHub repository
4. Select the `server/` directory as the root
5. Add environment variables in Railway dashboard:
   - `JWT_SECRET`: Generate a random string (e.g., `openssl rand -hex 32`)
   - `CORS_ORIGIN`: Your frontend URL (e.g., `https://your-app.vercel.app`)
   - `PORT`: Usually auto-set by Railway
6. Deploy - Railway will automatically:
   - Run `npm install`
   - Run `npm start`
7. Copy the deployed URL (e.g., `https://your-api.railway.app`)

#### Option 2: Render

1. Push code to GitHub
2. Go to [Render](https://render.com) and create new Web Service
3. Connect your GitHub repository
4. Settings:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables:
   - `JWT_SECRET`: Random string
   - `CORS_ORIGIN`: Your frontend URL
6. Deploy and copy the URL

### Frontend Deployment (Vercel or Netlify)

#### Option 1: Vercel

1. Push code to GitHub
2. Go to [Vercel](https://vercel.com) and import project
3. Settings:
   - Root Directory: `www`
   - Framework Preset: Other
4. Deploy
5. Update `www/js/api.js` with your backend URL:
   ```javascript
   const API_URL = 'https://your-api.railway.app/api';
   ```
6. Commit and push (Vercel will auto-deploy)
7. Copy frontend URL

#### Option 2: Netlify

1. Push code to GitHub
2. Go to [Netlify](https://netlify.com) and create new site
3. Connect repository
4. Settings:
   - Base directory: `www`
   - Publish directory: `www`
5. Deploy
6. Update API URL in `www/js/api.js` and redeploy

### Final Configuration

1. Update backend `CORS_ORIGIN` environment variable with your frontend URL
2. Update frontend `API_URL` in `www/js/api.js` with your backend URL
3. Redeploy both services
4. Test end-to-end

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Items (Protected - requires JWT token)
- `GET /api/items` - Get all user's items
- `POST /api/items` - Create new item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `PUT /api/items/:id/steps/:stepId` - Toggle step completion

### Health
- `GET /api/health` - Health check

## Environment Variables

### Backend
- `JWT_SECRET` (required) - Secret for signing JWT tokens
- `PORT` (optional) - Server port (default: 3000)
- `CORS_ORIGIN` (optional) - Allowed frontend origin (default: *)

### Frontend
- Update `API_URL` in `www/js/api.js` manually

## Database

- SQLite database file: `server/database.sqlite`
- Auto-created on first server start
- Schema includes: `users`, `items`, `steps` tables
- Foreign keys and indexes automatically created

## Security Notes (MVP)

- Passwords are hashed with bcrypt
- JWT tokens expire after 24 hours
- CORS configured for frontend domain
- SQL injection prevented via parameterized queries
- Basic email validation

## Production Upgrade Path

When ready to scale:

1. **Database**: Migrate SQLite → PostgreSQL
   - Change connection string in `server.js`
   - Same schema, just different database

2. **Structure**: Refactor single-file backend
   - Split `server.js` into organized folders
   - Copy existing code into modules

3. **Auth**: Add refresh tokens
   - Extend current JWT system
   - Add refresh endpoint

4. **Security**: Add rate limiting, input validation
   - Use express-rate-limit
   - Add validation middleware

5. **Monitoring**: Add error tracking and logging
   - Integrate Sentry or similar
   - Structured logging

## Troubleshooting

### Backend won't start
- Check `JWT_SECRET` is set
- Ensure port is available
- Check database file permissions

### CORS errors
- Verify `CORS_ORIGIN` matches frontend URL exactly
- Check backend logs for CORS errors

### Authentication fails
- Verify JWT_SECRET matches between deployments
- Check token expiration (24 hours)
- Clear browser localStorage and re-login

### Database errors
- Ensure `database.sqlite` is writable
- Check file permissions
- Delete and recreate if corrupted

## License

ISC

