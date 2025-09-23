# Online Workspace - Real-time Study Room Application

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Project Overview

Online Workspace is a React-based real-time study room application with LiveKit video calling, shared Pomodoro timer, and WebSocket game functionality. The application consists of a React frontend built with Vite and a Node.js WebSocket server for real-time communication.

## Working Effectively

### Prerequisites
- Node.js 18+ (currently running v20.19.5)
- npm 10+ (currently running v10.8.2)
- Firebase project credentials (optional for basic functionality)
- LiveKit account credentials (optional for video calling)

### Bootstrap and Development Commands

**Install dependencies:**
```bash
# Install main project dependencies
npm install

# Install server dependencies  
cd server && npm install && cd ..
```

**Environment setup:**
```bash
# Copy example environment file
cp .env.example .env
# Note: Application runs with demo data even without valid Firebase/LiveKit credentials
```

**Development servers:**
```bash
# Start both servers simultaneously (RECOMMENDED)
npm run dev:full
# This starts WebSocket server on port 8080 and Vite dev server on port 5173
# Startup time: < 1 second. NEVER CANCEL.

# OR start servers individually:
# Terminal 1: WebSocket server
npm run server
# OR for auto-restart during development:
npm run server:dev

# Terminal 2: Frontend development server  
npm run dev
```

**Build and deployment:**
```bash
# Development build
npm run build
# Build time: ~8 seconds. NEVER CANCEL. Set timeout to 60+ seconds.

# Production build  
npm run build:prod

# Preview production build
npm run preview

# Firebase deployment (requires valid Firebase config)
npx firebase deploy
```

**Code quality:**
```bash
# Lint code (has some expected warnings for server files)
npm run lint
# Runtime: ~5 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
```

## Validation Scenarios

**ALWAYS manually validate changes by running these scenarios:**

1. **Basic Application Loading:**
   - Start servers with `npm run dev:full`
   - Navigate to http://localhost:5173
   - Verify home page loads with "オンライン自習室" title
   - Check that room counter shows "現在の部屋数: 0/3 (MVP制限)"

2. **Room Creation Flow:**
   - Enter room title in "部屋のタイトルを入力" field
   - Enter username in "あなたの名前" field  
   - Click "部屋を作成" button
   - Verify room appears in active rooms list
   - Verify room counter increments
   - Verify clicking room navigates to room page

3. **WebSocket Server Connectivity:**
   - Check server logs show "✅ WebSocketサーバーがポート8080で正常に起動しました"
   - Verify no WebSocket connection errors in browser console
   - Test room functionality works (participants sync)

4. **Pomodoro Timer Functionality:**
   - In a room, verify timer shows "25:00" initially
   - Test timer start/stop controls (host only)
   - Verify timer state persists across page refreshes

5. **Build Validation:**
   - Run `npm run build` 
   - Verify dist/ folder is created with all assets
   - Run `npm run preview` and test basic functionality

## Build Times and Timeouts

- **NEVER CANCEL** any build or long-running command
- **npm install**: ~30-60 seconds. Set timeout to 300+ seconds.
- **npm run build**: ~8 seconds. Set timeout to 60+ seconds.  
- **npm run lint**: ~5 seconds. Set timeout to 30+ seconds.
- **Server startup**: <1 second. Set timeout to 30+ seconds.
- **Dev server startup**: ~300ms. Set timeout to 30+ seconds.

## Key Project Structure

```
online_workspace/
├── src/
│   ├── components/           # Shared UI components
│   │   └── VideoCallRoom.jsx # LiveKit video call integration
│   ├── config/              # Configuration files
│   │   └── livekit.js       # LiveKit client configuration
│   ├── collaboration/       # Participant management
│   ├── study-room/          # Main room functionality
│   │   └── components/RoomPage.jsx # Main room interface
│   ├── pomodoro-timer/      # Shared timer functionality
│   ├── entertainment/       # Game features
│   └── shared/              # Shared utilities and services
│       └── services/firestore.js # Firebase integration
├── server/                  # WebSocket server
│   ├── server.js           # Main WebSocket server
│   ├── gameLoop.js         # Game state management
│   ├── playerManager.js    # Player state management
│   └── state.js            # Room state management
├── .env.example            # Environment variables template
├── package.json            # Main project dependencies
├── vite.config.js          # Vite build configuration
├── firebase.json           # Firebase hosting configuration
└── render.yaml             # Render.com deployment configuration
```

## Common Development Tasks

**Working with LiveKit video calling:**
- Video calling requires valid VITE_LIVEKIT_* environment variables
- Without credentials, video call component shows connection errors but doesn't break the app
- LiveKit configuration is in `src/config/livekit.js`
- Test video calling by creating a room and checking camera/microphone permissions

**Working with Firebase Firestore:**
- Room state, participants, and timer data sync via Firestore
- Without credentials, app uses local state and shows connection warnings
- Firebase configuration is loaded from VITE_FIREBASE_* environment variables
- Firestore service is in `src/shared/services/firestore.js`

**Working with WebSocket games:**
- Game functionality requires WebSocket server to be running
- WebSocket server handles real-time game state synchronization
- Server files use CommonJS (require/module.exports) while client uses ES modules
- Test game functionality in entertainment section of rooms

**Working with the build system:**
- Vite configuration includes chunk splitting for optimal loading
- Build output goes to `dist/` folder
- CSS is processed with Tailwind and PostCSS
- Code splitting separates Firebase, LiveKit, React, and utility bundles

## Environment Variables

**Required for full functionality:**
```bash
# Firebase (for room state persistence)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# LiveKit (for video calling)
VITE_LIVEKIT_URL=wss://your-livekit-server.com
VITE_LIVEKIT_API_KEY=your_api_key
VITE_LIVEKIT_API_SECRET=your_api_secret

# WebSocket (for games - defaults to localhost:8080)
VITE_WEBSOCKET_URL=ws://localhost:8080
```

**Note:** Application works without valid credentials using demo/local data.

## Known Issues and Workarounds

- ESLint shows warnings for server files (CommonJS in ES module project) - this is expected
- Firebase connection timeouts in sandboxed environments - functionality degrades gracefully
- LiveKit connection requires valid credentials - component shows errors but doesn't crash
- Some dependencies have known vulnerabilities (run `npm audit` for details)

## CI/CD and Deployment

- No automated test suite currently exists
- Linting must pass before deployment (some server file warnings are acceptable)
- Firebase Hosting deployment: `npm run build && npx firebase deploy`
- Render.com WebSocket server deployment configured in `render.yaml`
- Production environment variables should be set in `.env.production`

## Frequently Used Commands Reference

```bash
# Quick development start
npm run dev:full

# Check project status
npm run lint
git status

# Build for production  
npm run build

# Clean development restart
rm -rf node_modules dist
npm install
cd server && npm install && cd ..
npm run dev:full

# Debug WebSocket server
cd server && npm run dev  # Uses nodemon for auto-restart
```

Always validate your changes by running through the complete validation scenarios above before committing.