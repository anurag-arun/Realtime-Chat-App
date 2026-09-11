# Real-Time Chat & Direct Messaging Web App

A full-stack real-time messaging application featuring public chat channels, private 1-on-1 direct messaging, live typing indicators, SQLite message persistence, and stateless JWT-based user authentication.

---

## Features

* **User Authentication:** Secure user registration and login using JSON Web Tokens (JWT) and `bcryptjs` password hashing.
* **Real-Time Communication:** Instant bidirectional messaging powered by Socket.io.
* **Public Channels:** Switch between multi-user channels (`#general`, `#random`, `#tech`).
* **Direct Messaging (DMs):** Private 1-on-1 chats between registered users using deterministic room routing.
* **Online Presence:** Real-time online status indicators for registered users.
* **Typing Indicator:** Real-time debounced feedback when users are typing in a channel or DM.
* **Persistent Storage:** Chat history and user profiles are stored locally in an SQLite database using `better-sqlite3`.

---

## Tech Stack

* **Backend:** Node.js, Express.js
* **Real-Time Engine:** Socket.io
* **Database:** SQLite (`better-sqlite3`)
* **Security & Auth:** JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `dotenv`
* **Frontend:** Vanilla HTML5, CSS3, JavaScript (Fetch API + Socket.io Client)

---

## Folder Structure

```text
Realtime Chat App/
├── public/
│   ├── index.html      # Client markup & socket event listeners
│   └── style.css       # Discord-inspired interface styling
├── .env                # Local secrets (not tracked by git)
├── .gitignore          # Git exclusion rules
├── chat.db             # Local SQLite database (auto-generated)
├── package.json        # Dependencies and startup scripts
└── server.js           # Express API, SQLite queries & Socket.io handling
