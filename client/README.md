# PrintFlow ERP Client App

This directory contains the React frontend application built with Vite, TypeScript, and TailwindCSS.

It communicates directly with a Supabase backend to perform all database transactions and authentication checks.

## Quick Start

1. Install client dependencies:
   ```bash
   npm install
   ```

2. Make sure your `client/.env` is configured:
   ```env
   VITE_SUPABASE_URL="https://your-supabase-url.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-key"
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

Refer to the main [Root README](../README.md) for full project architecture, database SQL schemas, and setup instructions.