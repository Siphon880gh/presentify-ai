# API Migration Specification

## Overview

This document describes how to migrate Presentify's client-side storage (localStorage + IndexedDB) to a server-side architecture using **MongoDB** and a **RESTful API** implemented in **plain PHP**.

---

## MongoDB Data Model

### Collections

| Collection | Description |
|------------|-------------|
| `users` | User accounts and credentials |
| `presentations` | Full presentation documents with embedded slides |
| `sessions` | Per-user working session state |
| `settings` | Per-user preferences |

---

### Collection Schemas

#### `users`

```javascript
{
  _id: ObjectId,
  email: String,           // unique, lowercase, trimmed
  passwordHash: String,    // bcrypt hash
  displayName: String,
  createdAt: ISODate
}
```

**Indexes:**
- `email` (unique)

---

#### `presentations`

```javascript
{
  _id: ObjectId,
  userId: ObjectId,        // references users._id
  title: String,
  slides: [
    {
      id: String,
      title: String,
      subtitle: String | null,
      content: [String],
      layout: String,       // enum: TITLE, BULLETS, IMAGE_LEFT, IMAGE_RIGHT, QUOTE, TWO_COLUMN
      imagePrompt: String | null,
      imageUrl: String | null,
      imageWidth: Number | null,
      imageHeight: Number | null,
      transitionType: String | null,  // enum: FADE, SLIDE, ZOOM
      notes: String | null,
      voiceName: String | null,
      floatingElements: [
        {
          id: String,
          type: String,     // enum: text, image
          content: String,
          x: Number,        // 0-100
          y: Number,        // 0-100
          width: Number | null,
          height: Number | null
        }
      ] | null
    }
  ],
  transitionType: String | null,
  defaultVoiceName: String | null,
  updatedAt: ISODate,
  createdAt: ISODate
}
```

**Indexes:**
- `userId`
- `updatedAt` (descending, for sorting)

---

#### `sessions`

```javascript
{
  _id: ObjectId,
  userId: ObjectId,        // unique, references users._id
  presentation: Object,    // embedded Presentation (same structure as presentations collection, minus _id)
  slideIndex: Number,
  updatedAt: ISODate
}
```

**Indexes:**
- `userId` (unique)

---

#### `settings`

```javascript
{
  _id: ObjectId,
  userId: ObjectId,        // unique, references users._id
  defaultAdvancedMode: Boolean,
  autoplayDelay: Number    // milliseconds
}
```

**Indexes:**
- `userId` (unique)

---

## TypeScript Type Definitions

```typescript
// Enums
enum SlideLayout {
  TITLE = 'TITLE',
  BULLETS = 'BULLETS',
  IMAGE_LEFT = 'IMAGE_LEFT',
  IMAGE_RIGHT = 'IMAGE_RIGHT',
  QUOTE = 'QUOTE',
  TWO_COLUMN = 'TWO_COLUMN'
}

enum SlideTransition {
  FADE = 'FADE',
  SLIDE = 'SLIDE',
  ZOOM = 'ZOOM'
}

// Documents
interface User {
  _id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

interface FloatingElement {
  id: string;
  type: 'text' | 'image';
  content: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  content: string[];
  layout: SlideLayout;
  imagePrompt?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  transitionType?: SlideTransition;
  notes?: string;
  voiceName?: string;
  floatingElements?: FloatingElement[];
}

interface Presentation {
  _id: string;
  userId: string;
  title: string;
  slides: Slide[];
  transitionType?: SlideTransition;
  defaultVoiceName?: string;
  updatedAt: string;
  createdAt: string;
}

interface PresentationMeta {
  _id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
}

interface Session {
  _id: string;
  userId: string;
  presentation: Omit<Presentation, '_id' | 'userId' | 'createdAt'>;
  slideIndex: number;
  updatedAt: string;
}

interface UserSettings {
  _id: string;
  userId: string;
  defaultAdvancedMode: boolean;
  autoplayDelay: number;
}
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api.php?action=signup` | Create new user account |
| POST | `/api.php?action=login` | Authenticate user |
| POST | `/api.php?action=logout` | End session |
| GET | `/api.php?action=me` | Get current user info |

### Presentations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api.php?action=presentations` | List user's presentations |
| GET | `/api.php?action=presentation&id={id}` | Get single presentation |
| POST | `/api.php?action=presentation` | Create new presentation |
| PUT | `/api.php?action=presentation&id={id}` | Update presentation |
| DELETE | `/api.php?action=presentation&id={id}` | Delete presentation |

### Session

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api.php?action=session` | Load current working session |
| PUT | `/api.php?action=session` | Save current working session |
| DELETE | `/api.php?action=session` | Clear current session |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api.php?action=settings` | Get user settings |
| PUT | `/api.php?action=settings` | Update user settings |

---

## Request/Response Specifications

### Authentication

#### POST `/api.php?action=signup`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secretpassword",
  "displayName": "John Doe"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | Yes | Valid email format |
| password | string | Yes | Minimum 6 characters |
| displayName | string | Yes | Non-empty after trim |

**Success Response (201):**
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "displayName": "John Doe",
    "createdAt": "2026-01-21T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Email already registered"
}
```

---

#### POST `/api.php?action=login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secretpassword"
}
```

| Field | Type | Required |
|-------|------|----------|
| email | string | Yes |
| password | string | Yes |

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "displayName": "John Doe",
    "createdAt": "2026-01-21T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

| Code | Error |
|------|-------|
| 401 | `{ "success": false, "error": "User not found" }` |
| 401 | `{ "success": false, "error": "Incorrect password" }` |

---

#### POST `/api.php?action=logout`

**Headers:**
```
Authorization: Bearer <token>
```

**Request:** Empty body

**Success Response (200):**
```json
{
  "success": true
}
```

---

#### GET `/api.php?action=me`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "displayName": "John Doe",
    "createdAt": "2026-01-21T10:30:00.000Z"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Not authenticated"
}
```

---

### Presentations

#### GET `/api.php?action=presentations`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "presentations": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "title": "Q4 Marketing Strategy",
      "updatedAt": "2026-01-21T10:30:00.000Z",
      "slideCount": 12
    }
  ]
}
```

---

#### GET `/api.php?action=presentation&id={id}`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "presentation": {
    "_id": "507f1f77bcf86cd799439012",
    "userId": "507f1f77bcf86cd799439011",
    "title": "Q4 Marketing Strategy",
    "slides": [
      {
        "id": "abc123def",
        "title": "Introduction",
        "subtitle": null,
        "content": ["Welcome to the presentation", "Key objectives"],
        "layout": "TITLE",
        "imagePrompt": null,
        "imageUrl": null,
        "imageWidth": null,
        "imageHeight": null,
        "transitionType": "FADE",
        "notes": "Open with enthusiasm",
        "voiceName": null,
        "floatingElements": null
      }
    ],
    "transitionType": "FADE",
    "defaultVoiceName": "Puck",
    "updatedAt": "2026-01-21T10:30:00.000Z",
    "createdAt": "2026-01-20T09:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error |
|------|-------|
| 404 | `{ "success": false, "error": "Presentation not found" }` |
| 403 | `{ "success": false, "error": "Access denied" }` |

---

#### POST `/api.php?action=presentation`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "title": "New Presentation",
  "slides": [
    {
      "id": "abc123def",
      "title": "Title Slide",
      "content": [],
      "layout": "TITLE"
    }
  ],
  "transitionType": "FADE",
  "defaultVoiceName": "Puck"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | Yes | Non-empty |
| slides | Slide[] | Yes | Array of slide objects |
| transitionType | string | No | FADE, SLIDE, or ZOOM |
| defaultVoiceName | string | No | Voice name |

**Slide Object:**

| Field | Type | Required |
|-------|------|----------|
| id | string | Yes |
| title | string | Yes |
| subtitle | string | No |
| content | string[] | Yes |
| layout | string | Yes |
| imagePrompt | string | No |
| imageUrl | string | No |
| imageWidth | number | No |
| imageHeight | number | No |
| transitionType | string | No |
| notes | string | No |
| voiceName | string | No |
| floatingElements | FloatingElement[] | No |

**Success Response (201):**
```json
{
  "success": true,
  "presentation": {
    "_id": "507f1f77bcf86cd799439012",
    "userId": "507f1f77bcf86cd799439011",
    "title": "New Presentation",
    "slides": [...],
    "transitionType": "FADE",
    "defaultVoiceName": "Puck",
    "updatedAt": "2026-01-21T10:30:00.000Z",
    "createdAt": "2026-01-21T10:30:00.000Z"
  }
}
```

---

#### PUT `/api.php?action=presentation&id={id}`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "title": "Updated Title",
  "slides": [...],
  "transitionType": "SLIDE",
  "defaultVoiceName": "Kore"
}
```

| Field | Type | Required |
|-------|------|----------|
| title | string | No |
| slides | Slide[] | No |
| transitionType | string | No |
| defaultVoiceName | string | No |

**Success Response (200):**
```json
{
  "success": true,
  "presentation": {
    "_id": "507f1f77bcf86cd799439012",
    "userId": "507f1f77bcf86cd799439011",
    "title": "Updated Title",
    "slides": [...],
    "transitionType": "SLIDE",
    "defaultVoiceName": "Kore",
    "updatedAt": "2026-01-21T11:00:00.000Z",
    "createdAt": "2026-01-21T10:30:00.000Z"
  }
}
```

---

#### DELETE `/api.php?action=presentation&id={id}`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**

| Code | Error |
|------|-------|
| 404 | `{ "success": false, "error": "Presentation not found" }` |
| 403 | `{ "success": false, "error": "Access denied" }` |

---

### Session

#### GET `/api.php?action=session`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "session": {
    "presentation": {
      "title": "Working Presentation",
      "slides": [...],
      "transitionType": "FADE",
      "defaultVoiceName": null,
      "updatedAt": "2026-01-21T10:30:00.000Z"
    },
    "slideIndex": 3
  }
}
```

**Response when no session exists (200):**
```json
{
  "success": true,
  "session": {
    "presentation": null,
    "slideIndex": 0
  }
}
```

---

#### PUT `/api.php?action=session`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "presentation": {
    "title": "Working Presentation",
    "slides": [...],
    "transitionType": "FADE",
    "defaultVoiceName": null
  },
  "slideIndex": 3
}
```

| Field | Type | Required |
|-------|------|----------|
| presentation | object | Yes |
| slideIndex | number | Yes |

**Success Response (200):**
```json
{
  "success": true
}
```

---

#### DELETE `/api.php?action=session`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true
}
```

---

### Settings

#### GET `/api.php?action=settings`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "settings": {
    "defaultAdvancedMode": true,
    "autoplayDelay": 2000
  }
}
```

---

#### PUT `/api.php?action=settings`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "defaultAdvancedMode": false,
  "autoplayDelay": 3000
}
```

| Field | Type | Required |
|-------|------|----------|
| defaultAdvancedMode | boolean | No |
| autoplayDelay | number | No |

**Success Response (200):**
```json
{
  "success": true,
  "settings": {
    "defaultAdvancedMode": false,
    "autoplayDelay": 3000
  }
}
```

---

## Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

**Standard HTTP Status Codes:**

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation errors) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (not authorized for resource) |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 500 | Internal Server Error |

---

## PHP Implementation Notes

### Single-File Structure (`api.php`)

The API should be implemented in a single PHP file with the following structure:

```php
<?php
// Configuration
define('MONGO_URI', 'mongodb://localhost:27017');
define('DB_NAME', 'presentify');
define('JWT_SECRET', 'your-secret-key');

// MongoDB connection
$client = new MongoDB\Client(MONGO_URI);
$db = $client->selectDatabase(DB_NAME);

// Collections
$usersCollection = $db->users;
$presentationsCollection = $db->presentations;
$sessionsCollection = $db->sessions;
$settingsCollection = $db->settings;

// Helper functions
function jsonResponse($data, $code = 200) { ... }
function getAuthUser() { ... }
function requireAuth() { ... }
function generateToken($userId) { ... }
function verifyToken($token) { ... }

// Route handling
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'signup':
        // POST only
        break;
    case 'login':
        // POST only
        break;
    case 'logout':
        // POST only
        break;
    case 'me':
        // GET only
        break;
    case 'presentations':
        // GET only (list)
        break;
    case 'presentation':
        // GET, POST, PUT, DELETE
        break;
    case 'session':
        // GET, PUT, DELETE
        break;
    case 'settings':
        // GET, PUT
        break;
    default:
        jsonResponse(['success' => false, 'error' => 'Unknown action'], 404);
}
```

### Authentication

- Use JWT tokens for stateless authentication
- Tokens passed via `Authorization: Bearer <token>` header
- Token contains `userId` and expiration
- Password hashing via `password_hash()` with `PASSWORD_BCRYPT`

### Required PHP Extensions

- `mongodb` (PHP MongoDB driver)
- `openssl` (for JWT)

### CORS Headers

```php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
```

---

## Migration Mapping

### localStorage → MongoDB

| localStorage Key | MongoDB Collection | Notes |
|------------------|-------------------|-------|
| `presentify_users` | `users` | Direct mapping |
| `presentify_auth` | JWT token | Stateless, client stores token |
| `presentify_settings` | `settings` | One document per user |

### IndexedDB → MongoDB

| IndexedDB Store | MongoDB Collection | Notes |
|-----------------|-------------------|-------|
| `presentations` | `presentations` | `id` → `_id`, add `createdAt` |
| `session` | `sessions` | Key `user_{userId}_current` → `userId` field |

### ID Field Changes

- Client-generated `id` (9-char alphanumeric) → MongoDB `_id` (ObjectId)
- Slide `id` fields remain client-generated strings (embedded documents)
- FloatingElement `id` fields remain client-generated strings

---

## Client-Side Changes Required

### Service Layer Updates

Replace `storageService.ts` functions with API calls:

```typescript
// Before (localStorage)
export const login = (email, password) => { ... }

// After (API)
export const login = async (email: string, password: string) => {
  const response = await fetch('/api.php?action=login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('presentify_token', data.token);
  }
  return data;
};
```

### Token Management

```typescript
const getAuthHeaders = () => {
  const token = localStorage.getItem('presentify_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};
```

### Session Persistence

- Replace `saveCurrentSession` interval with debounced API calls
- Consider WebSocket for real-time sync (optional enhancement)
