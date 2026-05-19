# BrandHub — Backend API

> Mini-marketplace for brands. Brands sell, customers buy. Real-time order updates via WebSocket.

---

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Real-time | ws (WebSocket) |
| File uploads | UploadThing |
| Testing | Jest + Supertest |

---

## Project Structure

```
src/
├── config/
│   ├── db.js              # MongoDB connection
│   └── uploadthing.js     # UploadThing router (3 upload types)
├── controllers/
│   ├── authController.js  # register, login, me, logout, avatar
│   ├── brandController.js # CRUD + logo
│   ├── productController.js # CRUD + images + search/filter
│   └── orderController.js # checkout, status, brand dashboard
├── middleware/
│   ├── auth.js            # protect + restrictTo
│   └── errorHandler.js    # global error handler
├── models/
│   ├── User.js            # name, email, password, role, avatar, isOnline
│   ├── Brand.js           # name, description, logo, owner, category, website, ...
│   ├── Product.js         # title, description, price, images, brand, stock, ...
│   └── Order.js           # user, items[], totalPrice, status, deliveryAddress, ...
├── routes/
│   ├── auth.js
│   ├── brands.js
│   ├── products.js
│   ├── orders.js
│   └── users.js           # /online endpoint
├── utils/
│   ├── jwt.js             # generateToken, verifyToken
│   └── helpers.js         # sendSuccess, sendError, calculateTotal
├── websocket/
│   └── wsManager.js       # initWebSocket, broadcastToUser, broadcastToBrand
├── app.js                 # Express app (routes, middleware)
└── server.js              # HTTP + WS server entry point

tests/
├── unit/
│   ├── userModel.test.js       # Mongoose validation
│   ├── helpers.test.js         # utility functions
│   └── authController.test.js  # route handler (mocked)
└── integration/
    ├── auth.test.js            # register/login/me via Supertest
    └── products.test.js        # product CRUD via Supertest
```

---

## Models & Relationships

### 4 Mongoose Models

| Model | Key Fields (5+) |
|-------|-----------------|
| **User** | name, email, password, role, avatar, isOnline, lastSeen |
| **Brand** | name, description, logo, owner, category, website, isActive, totalSales |
| **Product** | title, description, price, images, brand, stock, category, tags, isAvailable |
| **Order** | user, items[], totalPrice, status, deliveryAddress, paymentStatus, notes |

### Relationships

- **One-to-many**: `Brand → Products` — one brand has many products (`product.brand` refs `Brand._id`)
- **Many-to-many**: `Users ↔ Products` via `Order.items[]` — a user can order many products; a product can appear in many orders

---

## Authentication

- JWT signed with `JWT_SECRET`, expires in `JWT_EXPIRES_IN` (default `7d`)
- Passwords hashed with bcrypt (12 rounds)
- Protected routes use `Authorization: Bearer <token>` header
- Role-based access: `customer` vs `brand`

---

## WebSocket

Connect: `ws://localhost:5000?token=<jwt>`

### Events sent to client

| Event | Trigger | Recipients |
|-------|---------|-----------|
| `CONNECTED` | On successful WS auth | That user |
| `ONLINE_USERS` | Any user connects/disconnects | All clients |
| `NEW_ORDER` | Customer places order | Brand owner(s) in that order |
| `ORDER_STATUS_UPDATE` | Brand changes order status | Customer who placed it |
| `PONG` | Client sent `PING` | That client |

---

## UploadThing (3 upload types)

| Route key | Who | Files |
|-----------|-----|-------|
| `userAvatar` | Any authenticated user | 1 image, max 4MB |
| `brandLogo` | Brand role only | 1 image, max 4MB |
| `productImages` | Brand role only | Up to 5 images, max 8MB each |

After upload, call the relevant PATCH endpoint to save the URL to the database:
- `PATCH /api/auth/avatar` → `{ avatarUrl }`
- `PATCH /api/brands/:id/logo` → `{ logoUrl }`
- `PATCH /api/products/:id/images` → `{ imageUrls: [] }`

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register (role: customer\|brand) |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Get current user |
| POST | `/api/auth/logout` | ✅ | Logout (marks offline) |
| PATCH | `/api/auth/avatar` | ✅ | Update avatar URL |

### Brands
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/brands` | — | List brands (filter: category, search) |
| GET | `/api/brands/:id` | — | Brand detail + products |
| GET | `/api/brands/my/dashboard` | brand | Own brand |
| POST | `/api/brands` | brand | Create brand |
| PATCH | `/api/brands/:id` | brand | Update brand |
| DELETE | `/api/brands/:id` | brand | Deactivate brand |
| PATCH | `/api/brands/:id/logo` | brand | Update logo URL |

### Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | — | List (search, filter, paginate) |
| GET | `/api/products/:id` | — | Product detail |
| GET | `/api/products/brand/:brandId` | — | Products by brand |
| GET | `/api/products/my/products` | brand | Own products |
| POST | `/api/products` | brand | Create product |
| PATCH | `/api/products/:id` | brand | Update product |
| DELETE | `/api/products/:id` | brand | Delete product |
| PATCH | `/api/products/:id/images` | brand | Add image URLs |

### Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | customer | Place order |
| GET | `/api/orders/my` | customer | Own orders |
| GET | `/api/orders/brand` | brand | Orders for brand |
| GET | `/api/orders/:id` | ✅ | Order detail |
| PATCH | `/api/orders/:id/status` | brand | Update status |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/online` | ✅ | Online user IDs |

---

## Setup

```bash
# 1. Clone & install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MONGODB_URI, JWT_SECRET, UPLOADTHING keys

# 3. Run development server
npm run dev

# 4. Run tests
npm test
```

### Required env vars

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/brandhub
JWT_SECRET=changeme
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=...
```

---

## Tests

```bash
npm test              # run all tests
npm run test:coverage # with coverage report
```

**10 test cases** covering:
- Unit: User model validation (7 cases in `userModel.test.js`)
- Unit: `calculateTotal`, `sendSuccess`, `sendError` helpers
- Unit: `register` and `login` controllers (mocked DB)
- Integration: `POST /register`, `POST /login`, `GET /me` via Supertest
- Integration: Product CRUD via Supertest

---

## Deployment

| Service | What |
|---------|------|
| **Render / Railway** | Backend (Node.js) |
| **MongoDB Atlas** | Database |
| **UploadThing** | File storage |
| **Vercel** | Frontend (Next.js) |
