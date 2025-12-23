# Cognia Insightarium

**Your personal library of insights**

Cognia Insightarium is a personal knowledge collection tool that allows users to capture and manage useful information they come across online. The app supports importing bookmarks via browser bookmarklets, adding custom URLs, and supports raw text or markdown input. All collected items are stored in a structured database and displayed on a dashboard for review and later processing.

## Product Overview

Our initial focus is **top-of-funnel data capture**, not insight generation or distillation yet. Deduplication is essential: items should not be added twice.

### Features

- 📚 **Multi-source collection**: Import bookmarks via browser bookmarklets (X, LinkedIn, etc.)
- 🔗 **URL fetching**: Add custom URLs and automatically fetch their content
- ✍️ **Raw text input**: Add text or markdown content directly
- 🔍 **Deduplication**: Automatic detection and prevention of duplicate entries
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
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios

### Development Tools

- **Linting**: ESLint
- **Formatting**: Prettier
- **Package Manager**: npm (with workspaces)

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or higher)
- npm (v9 or higher)
- **PostgreSQL** - Choose one:
  - **Option A (Recommended)**: Docker Desktop - for isolated containerized database
  - **Option B**: PostgreSQL installed directly via Homebrew

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend and frontend dependencies (workspaces will handle this)
npm install
```

### 2. Database Setup

#### Option A: Using Docker (Recommended)

1. **Start PostgreSQL container**:
   ```bash
   docker-compose up -d
   ```
   This starts PostgreSQL in a Docker container on port 5432.

2. **Create `backend/.env` file**:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cognia_insightarium?schema=public
   PORT=3001
   NODE_ENV=development
   ```

3. **Run Prisma migrations**:
   ```bash
   cd backend
   npm run prisma:generate
   npm run prisma:migrate
   ```

**Useful Docker commands**:
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

3. **Create `backend/.env` file**:
   ```env
   DATABASE_URL=postgresql://your_username:your_password@localhost:5432/cognia_insightarium?schema=public
   PORT=3001
   NODE_ENV=development
   ```
   Replace `your_username` and `your_password` with your PostgreSQL credentials.

4. **Run Prisma migrations**:
   ```bash
   cd backend
   npm run prisma:generate
   npm run prisma:migrate
   ```

### 3. Environment Variables

Create a `backend/.env` file with the following variables:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cognia_insightarium?schema=public

# Optional: Frontend URL (defaults to http://localhost:3000)
FRONTEND_URL=http://localhost:3000

# LinkedIn API (optional - for LinkedIn integration)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_ACCESS_TOKEN=
```

**Note**: 
- **LinkedIn API**: Currently a placeholder implementation. LinkedIn credentials are optional and will return empty arrays until implemented.
- **Bookmarklets**: Use browser bookmarklets to import bookmarks from various sources (see `/save` route).

### 4. Start Development Servers

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

### 5. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

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
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   └── package.json
└── package.json             # Root workspace configuration
```

## API Endpoints

### Bookmarks

- `GET /api/bookmarks` - Get all bookmarks (optional `?source=x` query param)
- `GET /api/bookmarks/linkedin` - Fetch and save LinkedIn saved posts
- `POST /api/bookmarks/bulk` - Bulk save bookmarks (used by bookmarklets)
- `POST /api/bookmarks/check-duplicates` - Check for duplicate bookmarks
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
  externalId  String?  // ID from X, LinkedIn, etc
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

1. **Primary**: Check for existing bookmark by `source` + `externalId` (for items with external IDs like X, LinkedIn)
2. **Fallback**: Check for existing bookmark by `url` (for URL-based items)

If a duplicate is found, the existing bookmark is returned instead of creating a new one.

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

## External API Integrations

### LinkedIn API

The LinkedIn integration is currently a placeholder. To implement:

1. Create a LinkedIn app and obtain OAuth credentials
2. Add credentials to `backend/.env`
3. Implement the actual API calls in `backend/src/services/linkedInIntegration.ts`

**Note**: LinkedIn doesn't have a direct "saved posts" API endpoint, so this integration may require alternative approaches.

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

