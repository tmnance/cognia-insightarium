# Cognia Insightarium

**Your personal library of insights**

Cognia Insightarium is a personal knowledge collection tool that allows users to capture and manage useful information they come across online. The app supports importing bookmarks via browser scripts (X, Reddit, LinkedIn), adding custom URLs, and adding raw text or markdown content. All collected items are stored in a structured database with intelligent tagging, deduplication, and change tracking.

## Product Overview

Our initial focus is **top-of-funnel data capture**, not insight generation or distillation yet. Deduplication is essential: items should not be added twice. The system tracks changes to existing bookmarks and provides visual indicators for what has been updated.

### Features

- 📚 **Browser sync scripts**: Import bookmarks from X (Twitter), Reddit, and LinkedIn via browser extension scripts
- 🔗 **URL fetching**: Add custom URLs and automatically fetch their content
- ✍️ **Raw text input**: Add text or markdown content directly
- 🔍 **Smart deduplication**: Automatic detection and prevention of duplicate entries with visual indicators
- 🔄 **Change tracking**: Visual diff indicators showing what's changed in updated bookmarks (content, author)
- 🏷️ **Tag management**: Customizable tag system with colors, descriptions, and manual/auto-tagging
- 🤖 **LLM-powered tagging**: AI-assisted bulk categorization using ChatGPT/Grok for efficient tagging workflows
- 📊 **Dashboard**: View all collected items with search, filtering, sorting, and pagination
- 🔎 **Full-text search**: Search across content, URLs, authors, and tags
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
- **Chrome Browser** with [User JavaScript and CSS extension](https://chromewebstore.google.com/detail/user-javascript-and-css/nbhcbdghjpllgmfilhnhkllmkecfmpld) installed

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

# Platform saved bookmarks URLs (optional - for Sync Bookmarks dropdown)
SAVED_BOOKMARKS_URL_X=https://x.com/i/bookmarks
SAVED_BOOKMARKS_URL_REDDIT=https://www.reddit.com/user/YOUR_USERNAME/saved/
SAVED_BOOKMARKS_URL_LINKEDIN=https://www.linkedin.com/my-items/saved-posts/

# LLM Tagging (optional - link to your LLM categorization page)
LLM_BOOKMARK_CATEGORIZATION_URL=https://chatgpt.com/c/YOUR_CHAT_ID
```

### 4. Initialize Database

Run Prisma migrations to set up the database schema:

```bash
cd backend
npx prisma migrate dev --name init
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
- **Save Page** (for browser scripts): http://localhost:3000/save
- **LLM Tagging Page**: http://localhost:3000/tagging
- **Tag Management**: http://localhost:3000/tags

## Browser Script Setup

The primary way to import bookmarks is through browser scripts that extract saved posts from various platforms. These scripts use the **User JavaScript and CSS** Chrome extension to inject JavaScript into platform pages.

### Step 1: Install Browser Extension

Install the [User JavaScript and CSS extension](https://chromewebstore.google.com/detail/user-javascript-and-css/nbhcbdghjpllgmfilhnhkllmkecfmpld) and enable "Allow User Scripts" in extension settings.

### Step 2: Set Up Browser Scripts

The project includes sync scripts in `chrome-js-extension-scripts/`:

1. **Set up shared module**: Create a rule with no URL pattern, paste `__bookmarkSyncShared.js` content, and mark it as a shared module
2. **For each platform**, create a rule with the appropriate URL pattern, enabled the `__bookmarkSyncShared` shared module, and paste the corresponding script:
   - **X**: URL pattern `https://x.com/i/bookmarks*` → `sync-bookmarks-x.js`
   - **Reddit**: URL pattern `https://www.reddit.com/user/*/saved*` → `sync-bookmarks-reddit.js`
   - **LinkedIn**: URL pattern `https://www.linkedin.com/my-items/saved-posts*` → `sync-bookmarks-linkedin.js`

### Step 3: Using the Sync Scripts

1. Navigate to your saved posts page (e.g., `https://x.com/i/bookmarks`)
2. A control panel appears in the bottom-right with **Process** and **Send** buttons
3. Click **Process** to start extracting bookmarks from visible items
4. Scroll to load more items
5. Click **Send** to open the Save page and review before saving

**Auto-sync**: Add `?autosync=true` to the URL to automatically process and send bookmarks.

## Usage

- **Sync bookmarks**: Use browser scripts on saved posts pages (see Browser Script Setup)
- **Add manually**: Use "Add Bookmark" button for URLs or raw text
- **Manage tags**: Click tags to filter, use "+ Add tag" on bookmarks, or "Manage Tags" in header
- **LLM tagging**: Generate prompt on LLM Tagging page, paste into ChatGPT/Grok, apply response
- **Search**: Search bar filters by content, URL, author, or tags; sort by date; pagination supported

## Project Structure

Monorepo with `backend/` (Express + Prisma), `frontend/` (React + Vite), and `chrome-js-extension-scripts/` (browser sync scripts).

## API Endpoints

- `GET /api/bookmarks` - Get all bookmarks (supports `?source=` and `?tags=` filters)
- `POST /api/bookmarks/bulk` - Bulk save bookmarks
- `POST /api/bookmarks/check-duplicates` - Check for duplicates and changes
- `GET /api/tags` - Get all tags
- `POST /api/tags` - Create a tag
- `GET /api/bookmarks/llm-tagging/prompt` - Generate LLM tagging prompt
- `POST /api/bookmarks/llm-tagging/apply` - Apply tags from LLM response

## Database Schema

Uses Prisma with PostgreSQL. Main models: `Bookmark` (stores content with source, URL, author, timestamps), `Tag` (categorization), and `BookmarkTag` (many-to-many relationship with auto-tagging support).

## Deduplication and Change Tracking

Prevents duplicates by checking `source` + `externalId` (primary) or `url` (fallback). When a bookmark exists, compares content and author. Changed items are marked as "Updated" with visual diff indicators; unchanged items are marked as "Duplicate" and skipped.

## Development Scripts

- `npm run dev` - Start both backend and frontend
- `npm run lint` - Lint codebase
- `npm run format` - Format codebase
- `npx prisma migrate dev --name <name>` - Create database migration
- `npx prisma studio` - Open Prisma Studio (database GUI)

## Future Enhancements

- Insight generation and distillation
- Export functionality
- Browser extension (instead of User JavaScript and CSS)
