# Cognia Insightarium

**Your personal library of insights**

Cognia Insightarium is a personal knowledge collection tool that allows users to capture and manage useful information they come across online. The app supports importing bookmarks via browser bookmarklets (X, LinkedIn, etc.), adding custom URLs, and adding raw text or markdown content. All collected items are stored in a structured database and displayed on a dashboard for review and later processing.

## Product Overview

Our initial focus is **top-of-funnel data capture**, not insight generation or distillation yet. Deduplication is essential: items should not be added twice.

### Features

- 📚 **Browser bookmarklets**: Import bookmarks from X, LinkedIn, and other sources via browser bookmarklets
- 🔗 **URL fetching**: Add custom URLs and automatically fetch their content
- ✍️ **Raw text input**: Add text or markdown content directly
- 🔍 **Deduplication**: Automatic detection and prevention of duplicate entries with visual indicators
- 📊 **Dashboard**: View all collected items in one place
- 🎨 **Modern UI**: Built with React and Tailwind CSS

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **HTTP Client**: Axios

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 7
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Routing**: React Router

### Development Tools
- **Linting**: ESLint
- **Formatting**: Prettier
- **Package Manager**: npm (with workspaces)

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- **PostgreSQL** - Choose one:
  - **Option A (Recommended)**: Docker Desktop - for isolated containerized database
  - **Option B**: PostgreSQL installed directly via Homebrew

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd cognia-insightarium
npm install
```

This installs dependencies for the root workspace, backend, and frontend.

### 2. Database Setup

#### Option A: Using Docker (Recommended)

1. **Start PostgreSQL container**:
   ```bash
   docker-compose up -d
   ```
   This starts PostgreSQL in a Docker container on port 5432.

2. **Useful Docker commands**:
   - Stop database: `docker-compose down`
   - Stop and remove data: `docker-compose down -v`
   - View logs: `docker-compose logs postgres`

#### Option B: Local PostgreSQL Installation

1. **Install PostgreSQL** (if not already installed):
   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   ```

2. **Create a database**:
   ```bash
   createdb cognia_insightarium
   ```

### 3. Environment Configuration

Create a `backend/.env` file:

```env
# Server
PORT=3001
NODE_ENV=development

# Database (adjust for your setup)
# Docker:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cognia_insightarium?schema=public
# Local:
# DATABASE_URL=postgresql://your_username:your_password@localhost:5432/cognia_insightarium?schema=public

# Frontend URL (optional, defaults to http://localhost:3000)
FRONTEND_URL=http://localhost:3000
```

### 4. Initialize Database

Run Prisma migrations to set up the database schema:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### 5. Start Development Servers

From the root directory:

```bash
# Start both backend and frontend
npm run dev
```

Or start them separately:

```bash
# Backend only (runs on http://localhost:3001)
npm run dev:backend

# Frontend only (runs on http://localhost:3000)
npm run dev:frontend
```

### 6. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Save Page** (for bookmarklets): http://localhost:3000/save

## Usage

### Browser Bookmarklets

The primary way to import bookmarks is through browser bookmarklets. These bookmarklets send data to the `/save` page via `postMessage`:

1. Create a bookmarklet that captures the current page content
2. The bookmarklet sends data to `http://localhost:3000/save` using `postMessage`
3. The `/save` page displays received items and checks for duplicates
4. Users can review and save new (non-duplicate) items

**Expected message format**:
```javascript
window.postMessage({
  t: "XBM",  // Message type identifier
  p: JSON.stringify([{
    platform: "x",
    url: "https://x.com/...",
    text: "Tweet content...",
    author: "@username",
    timestamp: "2025-01-01T00:00:00.000Z"
  }])
}, "*");
```

The `/save` page automatically:
- Checks for duplicates against existing bookmarks
- Highlights duplicate items visually
- Shows counts of new vs. duplicate items
- Only saves new (non-duplicate) items when "Save All" is clicked

### Adding Bookmarks Manually

- **URL**: Use the "Add Bookmark" form on the dashboard to add a URL
- **Raw Text**: Use the "Add Raw Text" option to add text or markdown content directly

## Project Structure

```
cognia-insightarium/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration (env variables)
│   │   ├── db/              # Database (Prisma client)
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic services
│   │   ├── utils/           # Utilities (logger, deduplication)
│   │   └── index.ts         # Express app entry point
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components (Dashboard, Save)
│   │   ├── services/        # API client
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   └── package.json
├── docker-compose.yml       # PostgreSQL Docker configuration
└── package.json             # Root workspace configuration
```

## API Endpoints

### Bookmarks

- `GET /api/bookmarks` - Get all bookmarks (optional `?source=<source>` query param)
- `POST /api/bookmarks/bulk` - Bulk save bookmarks (used by bookmarklets)
  ```json
  [
    {
      "platform": "x",
      "url": "https://x.com/...",
      "text": "Content...",
      "author": "@username",
      "timestamp": "2025-01-01T00:00:00.000Z"
    }
  ]
  ```
- `POST /api/bookmarks/check-duplicates` - Check for duplicate bookmarks
  ```json
  [
    {
      "platform": "x",
      "url": "https://x.com/...",
      "text": "Content..."
    }
  ]
  ```
  Returns: `{ "success": true, "duplicateIndices": [0, 2], "count": 2 }`
- `POST /api/bookmarks/url` - Add a bookmark from a URL
  ```json
  {
    "url": "https://example.com/article"
  }
  ```

### Content

- `POST /api/content/raw` - Add raw text or markdown content
  ```json
  {
    "content": "Your text content here...",
    "title": "Optional title"
  }
  ```

### Health

- `GET /health` - Health check endpoint

## Database Schema

The `Bookmark` model stores all collected items:

```prisma
model Bookmark {
  id          String   @id @default(cuid())
  source      String   // "x", "linkedin", "url", "raw"
  externalId  String?  // ID from external source (e.g., tweet ID)
  url         String?
  title       String?
  content     String?  // fetched HTML or raw text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([source, externalId])
  @@index([url])
  @@index([source])
}
```

## Deduplication Logic

The app prevents duplicate entries using a two-step approach:

1. **Primary**: Check for existing bookmark by `source` + `externalId` (for items with external IDs like X tweets)
2. **Fallback**: Check for existing bookmark by `url` (for URL-based items)

If a duplicate is found, the existing bookmark is returned instead of creating a new one.

On the `/save` page:
- Duplicates are automatically detected when items are received
- Duplicate items are visually highlighted with amber styling
- The UI shows separate counts for new vs. duplicate items
- The "Save All" button only saves new (non-duplicate) items and is disabled if there are no new items

## Development Scripts

### Root Level

- `npm run dev` - Start both backend and frontend in development mode
- `npm run lint` - Lint both backend and frontend
- `npm run format` - Format code in both backend and frontend

### Backend

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

### Frontend

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Future Enhancements

- Insight generation and distillation
- Full-text search
- Tagging and categorization
- Export functionality
- Batch processing
- Content preview generation

## License

[Your License Here]

## Contributing

[Your Contributing Guidelines Here]
