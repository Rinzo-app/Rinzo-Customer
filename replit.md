# Saaf - Laundry Service Mobile App

## Overview

Saaf is a laundry service marketplace mobile application built with Expo (React Native) on the frontend and Express.js on the backend. Customers can browse nearby laundry shops, select services (wash & fold, dry clean, iron, etc.), place orders with pickup/delivery scheduling, manage addresses, and track order status. The app uses phone-based OTP authentication and a dark-themed UI design.

The project runs as two processes: an Expo development server for the React Native app (web target primarily on Replit) and an Express.js API server on port 5000.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)
- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Navigation**: File-based routing via `expo-router` with tab navigation (`(tabs)/`) and stack screens for shop details, orders, and address management
- **State Management**: `@tanstack/react-query` for server state caching and data fetching; React context (`AuthProvider`) for authentication state
- **Styling**: React Native `StyleSheet` with a centralized dark theme color system defined in `constants/colors.ts`
- **Fonts**: Nunito Sans (Regular, SemiBold, Bold, ExtraBold) loaded via `@expo-google-fonts/nunito-sans`
- **Key Libraries**: `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`, `expo-linear-gradient`, `expo-blur`, `expo-image-picker`, `expo-location`
- **Auth Token Storage**: `@react-native-async-storage/async-storage` for persisting JWT tokens and customer data on-device

### Screen Structure
- `app/index.tsx` — Auth check splash/redirect
- `app/login.tsx` — Phone number input
- `app/verify.tsx` — OTP verification (6-digit code)
- `app/(tabs)/index.tsx` — Home screen with shop listing, distance calculation, favorites
- `app/(tabs)/orders.tsx` — Order history with status badges
- `app/(tabs)/profile.tsx` — User profile, name editing, logout
- `app/shop/[id].tsx` — Shop detail with service listing and item selection
- `app/order/new.tsx` — New order creation with pickup slot selection
- `app/order/[id].tsx` — Order detail with status timeline
- `app/address/manage.tsx` — Address CRUD management

### Backend (Express.js)
- **Runtime**: Node.js with TypeScript (compiled via `tsx` in dev, `esbuild` for production)
- **Server Entry**: `server/index.ts` — Sets up CORS, JSON parsing, routes, and serves static build in production
- **Routes**: `server/routes.ts` — RESTful API endpoints for auth, shops, services, orders, addresses, favorites
- **Storage Layer**: `server/storage.ts` — Database access functions using Drizzle ORM
- **Auth**: `server/auth.ts` — JWT-based authentication with OTP generation/verification; in-memory OTP store; test phone `+911234567890` with OTP `123456`
- **CORS**: Dynamic origin allowlist based on Replit environment variables, plus localhost support for Expo web dev

### API Endpoints
- `POST /api/auth/send-otp` — Send OTP to phone number
- `POST /api/auth/verify-otp` — Verify OTP and get JWT token + customer object
- `GET /api/me` — Get current customer profile (auth required)
- `PUT /api/me/name` — Update customer name (auth required)
- `GET /api/shops` — List all active shops
- `GET /api/shops/:id` — Get shop details
- `GET /api/shops/:id/services` — Get services for a shop
- `GET /api/orders` — List customer orders (auth required)
- `GET /api/orders/:id` — Get order detail (auth required)
- `POST /api/orders` — Create new order (auth required)
- `GET /api/addresses` — List customer addresses (auth required)
- `POST /api/addresses` — Add address (auth required)
- `DELETE /api/addresses/:id` — Delete address (auth required)
- `PUT /api/addresses/:id/default` — Set default address (auth required)
- `GET /api/favorites` — List favorites (auth required)
- `POST /api/favorites/:shopId` — Toggle favorite (auth required)
- `GET /api/favorites/:shopId/check` — Check if shop is favorited (auth required)

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema** (`shared/schema.ts`): Shared between frontend and backend
  - `customers` — id (UUID), phone (unique), name, createdAt
  - `addresses` — id, customerId (FK), label, addressLine, lat, lng, isDefault
  - `shops` — id, name, phone, address, lat, lng, rating, totalRatings, imageUrl, openTime, closeTime, isActive, minOrder, deliveryFee
  - `services` — id, shopId (FK), category, name, price, unit, etc.
  - `orders` — id, customerId, shopId, addressId, items (JSONB), status, total, pickupSlot, etc.
  - `favorites` — id, customerId, shopId
- **Migrations**: Generated via `drizzle-kit` to `./migrations/` directory; push with `npm run db:push`
- **Connection**: `pg` Pool using `DATABASE_URL` environment variable

### Shared Code
- `shared/schema.ts` — Database table definitions and TypeScript types shared between server and client via `@shared/*` path alias

### Build & Deployment
- **Dev**: Two processes — `npm run expo:dev` (Expo web) and `npm run server:dev` (Express API)
- **Production Build**: `npm run expo:static:build` generates static web assets; `npm run server:build` bundles server with esbuild; `npm run server:prod` serves both API and static files
- **Static Build Script**: `scripts/build.js` starts Metro bundler, fetches the bundle, and saves static HTML/JS output

## External Dependencies

### Database
- **PostgreSQL** — Primary data store, connected via `DATABASE_URL` environment variable

### Authentication
- **JWT** (`jsonwebtoken`) — Token-based auth with 30-day expiry
- **Firebase Admin SDK** (`firebase-admin`) — Listed as dependency (likely for future SMS OTP delivery); currently OTPs are generated in-memory on the server

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — JWT signing secret (defaults to `saaf-dev-secret-key` in dev)
- `EXPO_PUBLIC_DOMAIN` — Domain for API requests from the mobile app
- `REPLIT_DEV_DOMAIN` — Auto-set by Replit for dev environment
- `REPLIT_INTERNAL_APP_DOMAIN` — Auto-set by Replit for deployments

### Key NPM Packages
- `express` v5 — HTTP server
- `drizzle-orm` + `drizzle-kit` — ORM and migration tooling
- `pg` — PostgreSQL client
- `@tanstack/react-query` — Data fetching and caching
- `expo-router` — File-based navigation
- `zod` + `drizzle-zod` — Runtime schema validation
- `http-proxy-middleware` — Dev proxy setup
- `patch-package` — Post-install patches (runs via `postinstall` script)