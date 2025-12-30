# Why You're Hitting Connection Limits (Even With Just One User)

## The Confusion

You're thinking: "I'm the only user, how can there be 15-20 database connections?"

This is a **common misunderstanding** about how serverless functions work!

## What's Actually Happening

### In Serverless (Vercel), Each Request = New Function Instance

When you use the app, each action can trigger **multiple serverless function invocations simultaneously**:

1. **Page Load**: 
   - Next.js middleware runs (checks auth) → 1 connection
   - Page component loads → 1 connection
   - API calls for data → 1-2 connections
   - Total: **3-4 connections** for a single page load

2. **Navigation Between Pages**:
   - Old page unloading + new page loading = **overlapping connections**
   - Middleware runs on every route change → **new connection**
   - Data fetching for new page → **new connection**

3. **Background Requests**:
   - Polling/refreshing data (like calls list)
   - Form submissions
   - API route handlers
   - Each creates a **new function instance with its own connection pool**

4. **Middleware Runs on EVERY Request**:
   - Every route change
   - Every API call
   - Every static asset request (sometimes)
   - Each middleware invocation can open a connection

### Real Example: Opening the Dashboard

When you navigate to `/dashboard`:
1. **Middleware** checks auth → Opens connection (to check user in DB)
2. **Page Server Component** runs → Opens connection (to fetch dashboard data)
3. **API call** to `/api/patients` (if any) → Opens connection
4. **API call** to `/api/appointments` (if any) → Opens connection

That's **4+ connections** from a single page load!

### The Math

- Each Prisma Client instance can open up to **5 connections** (we set `connection_limit=5`)
- If you have **4 concurrent function invocations** (middleware + page + 2 API calls)
- That's **4 × 5 = 20 connections** easily!

And these connections **overlap in time** - they don't close immediately. So:
- Connection 1 opens (middleware)
- Connection 2 opens (page load) - Connection 1 still open
- Connection 3 opens (API call) - Connections 1 & 2 still open
- etc.

Before connections close, you've already hit the limit!

## Why Session Mode Fails

**Session Mode (port 5432)**:
- Limit: ~15-20 total connections
- One user = multiple function instances = multiple connection pools = **LIMIT EXCEEDED**

**Transaction Mode (port 6543)**:
- Limit: Hundreds of connections
- Same scenario = **NO PROBLEM** ✅

## The Solution

Switch to **Transaction Mode (port 6543)** - it's designed exactly for this serverless scenario.

## How to Verify This

You can see this happening:

1. Open browser DevTools → Network tab
2. Navigate around your app
3. Watch the **multiple simultaneous requests** firing
4. Each one creates a new serverless function instance
5. Each function instance opens database connections

Even with one user, you'll see 5-10+ requests happening at once!

