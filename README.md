# HawkBeak Chat — Backend

Production-ready Node.js/Express/Socket.IO backend for the **HawkBeak Chat** application.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.example .env

# 3. Run in development
npm run dev

# 4. Run in production
npm start
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default `5000`) |
| `NODE_ENV` | `development` or `production` |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | Token lifetime e.g. `7d` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLIENT_URL` | Frontend URL for CORS (e.g. `https://hawkbeakchat.vercel.app`) |

---

## Project Structure

```
backend/
├── config/
│   ├── db.js                  # MongoDB connection
│   └── cloudinary.js          # Cloudinary + multer storage
├── controllers/
│   ├── authController.js
│   ├── chatController.js
│   ├── groupController.js
│   ├── messageController.js
│   ├── notificationController.js
│   └── userController.js
├── middleware/
│   ├── auth.js                # JWT protect middleware
│   ├── errorHandler.js        # Global error handler
│   └── validate.js            # express-validator runner
├── models/
│   ├── Chat.js
│   ├── Message.js
│   ├── Notification.js
│   └── User.js
├── routes/
│   ├── authRoutes.js
│   ├── chatRoutes.js
│   ├── groupRoutes.js
│   ├── messageRoutes.js
│   ├── notificationRoutes.js
│   └── userRoutes.js
├── socket/
│   └── socketHandler.js       # All Socket.IO logic
├── utils/
│   ├── apiResponse.js
│   ├── asyncHandler.js
│   └── generateToken.js
├── validations/
│   ├── authValidations.js
│   └── messageValidations.js
├── uploads/                   # Local upload fallback
├── app.js                     # Express app
├── server.js                  # HTTP + Socket server entry
├── package.json
└── .env.example
```

---

## REST API Reference

All protected routes require `Authorization: Bearer <token>` header.

### Auth  `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | ✗ | Register (multipart/form-data; `profilePicture` optional) |
| POST | `/login` | ✗ | Login, returns JWT |
| POST | `/logout` | ✓ | Logout, clears session |
| GET | `/me` | ✓ | Get current user profile |

**Signup body**
```json
{
  "fullName": "Jane Doe",
  "username": "janedoe",
  "email": "jane@example.com",
  "password": "secret123"
}
```

**Login body**
```json
{ "email": "jane@example.com", "password": "secret123" }
```

---

### Users  `/api/users`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all users (excluding self) |
| GET | `/search?q=<query>` | Search by name / username / email |
| GET | `/:id` | Get user by ID |
| PUT | `/profile` | Update profile (multipart; `profilePicture` optional) |
| PUT | `/password` | Change password |

---

### Chats  `/api/chats`

| Method | Path | Description |
|---|---|---|
| POST | `/` | Access or create a 1:1 chat — body: `{ userId }` |
| GET | `/` | Get all chats for current user |
| GET | `/:id` | Get single chat |
| DELETE | `/:id` | Delete chat and all its messages |

---

### Groups  `/api/groups`

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create group (multipart; `groupAvatar` optional) |
| PUT | `/:id` | Update group info / avatar (admin only) |
| POST | `/:id/members` | Add members — body: `{ userIds: [] }` |
| DELETE | `/:id/members/:memberId` | Remove member (admin only) |
| POST | `/:id/leave` | Leave group |
| POST | `/:id/transfer-admin` | Transfer admin — body: `{ newAdminId }` |
| DELETE | `/:id` | Delete group (admin only) |

---

### Messages  `/api/messages`

| Method | Path | Description |
|---|---|---|
| POST | `/` | Send message — body: `{ chatId, content }` |
| GET | `/:chatId` | Get paginated messages — query: `page`, `limit` |
| PATCH | `/:messageId/read` | Mark as read |
| PATCH | `/:messageId/delivered` | Mark as delivered |
| DELETE | `/:messageId` | Soft delete own message |
| GET | `/unread` | Get unread counts per chat |
| GET | `/search?q=&chatId=` | Search messages |

---

### Notifications  `/api/notifications`

| Method | Path | Description |
|---|---|---|
| GET | `/` | Get notifications (last 50) |
| PATCH | `/:id/read` | Mark one notification as read |
| PATCH | `/read-all` | Mark all notifications as read |

---

## Socket.IO Reference

Connect with:
```js
import { io } from "socket.io-client";

const socket = io("https://your-backend.com", {
  auth: { token: "<JWT>" },
  transports: ["websocket", "polling"],
});
```

---

### Client → Server Events

#### `joinChat`
Join a chat room.
```json
{ "chatId": "<chatId>" }
```

#### `leaveChat`
Leave a chat room.
```json
{ "chatId": "<chatId>" }
```

#### `sendMessage`
Send a new message via socket (alternative to REST POST).
```json
{ "chatId": "<chatId>", "content": "Hello!" }
```

#### `typing`
Signal typing in a chat.
```json
{ "chatId": "<chatId>" }
```

#### `stopTyping`
Signal stopped typing.
```json
{ "chatId": "<chatId>" }
```

#### `markRead`
Mark messages as read.
```json
{ "chatId": "<chatId>", "messageIds": ["<id1>", "<id2>"] }
```

#### `markDelivered`
Acknowledge delivery of messages.
```json
{ "chatId": "<chatId>", "messageIds": ["<id1>"] }
```

#### `updateStatus`
Change availability status.
```json
{ "status": "Busy" }
```

#### `groupAction`
Relay group-level updates to room members.
```json
{ "chatId": "<chatId>", "action": "memberAdded", "data": {} }
```

---

### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `onlineUsers` | `{ users: [userId, ...] }` | List of online user IDs on connect |
| `userOnline` | `{ userId, isOnline: true }` | A user came online |
| `userOffline` | `{ userId, lastSeen }` | A user went offline |
| `userStatusChanged` | `{ userId, status }` | User changed status |
| `joinedChat` | `{ chatId }` | Confirmation of joinChat |
| `leftChat` | `{ chatId }` | Confirmation of leaveChat |
| `newMessage` | `{ message }` | New message in a room |
| `messageDelivered` | `{ messageId, chatId, deliveredTo }` | Message delivery update |
| `messagesRead` | `{ chatId, userId, messageIds, readAt }` | Read receipt broadcast |
| `messagesDelivered` | `{ chatId, userId, messageIds, deliveredAt }` | Delivery acknowledgement |
| `userTyping` | `{ chatId, userId, username, fullName }` | Someone is typing |
| `userStoppedTyping` | `{ chatId, userId }` | Someone stopped typing |
| `groupUpdated` | `{ chatId, action, data }` | Group-level change |
| `notification` | `{ type, chatId, message }` | In-app notification push |
| `error` | `{ message }` | Socket error |

---

## WhatsApp-style Read Receipts

```
Message created           → status: "sent"      (✓)
Recipient comes online    → status: "delivered"  (✓✓ grey)
Recipient opens chat &
  emits markRead          → status: "read"       (✓✓ blue)
```

For **group chats**, `readBy` is an array — the message is considered "read" when at least one non-sender participant reads it; the full array is available for per-member receipt UI.

---

## Deployment (Railway / Render / Fly.io)

1. Set all env variables in your platform dashboard.
2. Set `NODE_ENV=production`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Ensure `CLIENT_URL` matches your Vercel frontend URL exactly.

---

## Security Features

- **Helmet** — HTTP security headers
- **Rate limiting** — 10 requests / 15 min on auth routes
- **express-mongo-sanitize** — prevents NoSQL injection
- **bcryptjs (cost 12)** — password hashing
- **JWT** — stateless auth
- **Input validation** — express-validator on all inputs
- **Soft delete** — messages are never hard-deleted by users
