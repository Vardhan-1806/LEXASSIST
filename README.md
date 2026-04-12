# ⚖️ LEXASSIST — AI-Powered Legal Assistance & Appointment Platform

> **Minor Project | 2nd Year B.Tech/BCA**  
> A full-stack web platform that makes legal help accessible to every citizen of India using AI, RAG, and modern web technologies.

---

## 🚀 Project Overview

LEXASSIST is a comprehensive legal assistance platform that combines:
- 🤖 AI-powered legal chatbot (RAG on Indian law documents)
- 📋 Case tracking with visual timelines and priority system
- 🔍 Lawyer discovery and booking
- 📅 Integrated legal calendar
- 🛡️ Role-based dashboards for Citizens, Lawyers, and Admins

---

## 🗂️ Folder Structure

```
LEXASSIST/
│
├── server.js                    ← Main entry point (Express server)
├── package.json                 ← Dependencies & scripts
├── .env                         ← Environment variables (not committed)
├── .gitignore
│
├── Backend/
│   ├── config/
│   │   └── db.js                ← MongoDB connection
│   ├── controllers/
│   │   ├── authController.js    ← Register, login, profile
│   │   ├── caseController.js    ← Case CRUD, priority, timeline
│   │   ├── lawyerController.js  ← Lawyer search, profiles, reviews
│   │   ├── appointmentController.js ← Booking, slots, status
│   │   ├── chatbotController.js ← RAG AI chatbot logic
│   │   └── adminController.js   ← Admin dashboard, verification
│   ├── middleware/
│   │   └── auth.js              ← JWT protect + role authorize
│   ├── models/
│   │   ├── User.js              ← User schema (citizen/lawyer/admin)
│   │   ├── Lawyer.js            ← Lawyer profile, availability
│   │   ├── Case.js              ← Case with stages, timeline, priority
│   │   ├── Appointment.js       ← Booking system
│   │   └── Extras.js            ← Review, Document, Notification, ChatHistory, CalendarEvent
│   └── routes/
│       ├── authRoutes.js
│       ├── caseRoutes.js
│       ├── lawyerRoutes.js
│       ├── appointmentRoutes.js
│       ├── chatbotRoutes.js
│       ├── calendarRoutes.js
│       ├── adminRoutes.js
│       ├── documentRoutes.js
│       ├── notificationRoutes.js
│       └── userRoutes.js
│
├── Frontend/
│   ├── public/
│   │   ├── css/
│   │   │   └── main.css         ← Full design system (Navy + Gold theme)
│   │   └── js/
│   │       └── app.js           ← Shared utilities (Auth, API, Toast, DateUtils)
│   └── views/
│       ├── auth/
│       │   ├── landing.html     ← Marketing homepage
│       │   ├── login.html       ← Login with demo accounts
│       │   └── register.html    ← Register as Citizen or Lawyer
│       ├── citizen/
│       │   ├── dashboard.html   ← Citizen overview with stats
│       │   ├── cases.html       ← Case list with timeline & priority
│       │   ├── chatbot.html     ← Full AI chatbot interface
│       │   └── lawyers.html     ← Lawyer search & booking
│       ├── lawyer/
│       │   └── dashboard.html   ← Lawyer practice overview
│       ├── admin/
│       │   └── dashboard.html   ← Admin control panel
│       └── shared/
│           ├── calendar.html    ← Legal calendar view
│           ├── appointments.html← Appointments management
│           └── 404.html         ← 404 page
│
├── Ai_Chatbot_Rag/
│   ├── knowledge_base/
│   │   └── indian_law_basics.txt ← Legal knowledge for RAG
│   ├── embeddings/              ← Vector store (auto-generated)
│   └── utils/                   ← RAG utilities
│
├── DataBase_Ai_Data/
│   └── seed.js                  ← Database seeder with sample data
│
└── Documentation/
    └── (API docs, screenshots)
```

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- (Optional) OpenAI API key for full AI features

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Edit `.env` with your values:
```env
MONGO_URI=mongodb://localhost:27017/lexassist
JWT_SECRET=your_secret_key
OPENAI_API_KEY=your_openai_key   # Optional – fallback works without it
```

### 4. Seed Database (Optional)
```bash
node DataBase_Ai_Data/seed.js
```

### 5. Start Server
```bash
npm start         # Production
npm run dev       # Development (with nodemon)
```

### 6. Open in Browser
```
http://localhost:5000
```

---

## 🎭 Demo Accounts (after seeding)

| Role    | Email                     | Password    |
|---------|---------------------------|-------------|
| Citizen | rajesh@example.com        | User@123    |
| Lawyer  | priya@lexassist.com       | Lawyer@123  |
| Admin   | admin@lexassist.com       | Admin@123   |

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint                    | Description         |
|--------|-----------------------------|---------------------|
| POST   | /api/auth/register          | Register user       |
| POST   | /api/auth/login             | Login               |
| GET    | /api/auth/me                | Get current user    |
| PUT    | /api/auth/update            | Update profile      |
| PUT    | /api/auth/change-password   | Change password     |

### Cases
| Method | Endpoint                       | Description         |
|--------|--------------------------------|---------------------|
| GET    | /api/cases                     | Get all cases       |
| POST   | /api/cases                     | Create case         |
| GET    | /api/cases/:id                 | Get case details    |
| PUT    | /api/cases/:id                 | Update case         |
| PUT    | /api/cases/:id/stage/:i        | Complete stage      |
| GET    | /api/cases/stats               | Case statistics     |

### Lawyers
| Method | Endpoint                    | Description             |
|--------|-----------------------------|-------------------------|
| GET    | /api/lawyers                | Search lawyers          |
| GET    | /api/lawyers/:id            | Lawyer profile          |
| POST   | /api/lawyers/register       | Register as lawyer      |
| PUT    | /api/lawyers/profile        | Update lawyer profile   |
| POST   | /api/lawyers/:id/review     | Add review              |

### Appointments
| Method | Endpoint                         | Description         |
|--------|----------------------------------|---------------------|
| GET    | /api/appointments                | Get appointments    |
| POST   | /api/appointments                | Book appointment    |
| PUT    | /api/appointments/:id/status     | Update status       |
| GET    | /api/appointments/slots          | Available slots     |

### Chatbot (RAG)
| Method | Endpoint                         | Description         |
|--------|----------------------------------|---------------------|
| POST   | /api/chatbot/message             | Send message        |
| GET    | /api/chatbot/history             | Chat history        |
| DELETE | /api/chatbot/history/:sessionId  | Delete session      |

---

## 🌟 Key Features

| Feature | Description |
|---------|-------------|
| **AI Chatbot (RAG)** | Answers legal questions using knowledge base. Uses OpenAI GPT-3.5 if API key set, else smart fallback |
| **Case Priority** | Auto-assigns 🔴 High / 🟠 Medium / 🟢 Low based on hearing dates |
| **Case Timeline** | 5-stage visual progress tracker for each case |
| **Lawyer Search** | Filter by specialization, city, experience, fee |
| **Appointment Booking** | Real-time slot availability, in-person/online/phone |
| **Legal Calendar** | Full monthly calendar with event types |
| **Role Dashboards** | Separate views for Citizen, Lawyer, Admin |
| **JWT Auth** | Secure token-based authentication |
| **Smart Notifications** | Real-time alerts for all important events |

---

## 🛠️ Tech Stack

| Layer      | Technology |
|------------|------------|
| Backend    | Node.js, Express.js |
| Database   | MongoDB, Mongoose ODM |
| Auth       | JWT (JSON Web Tokens), bcryptjs |
| AI/RAG     | OpenAI GPT-3.5, LangChain (optional) |
| Frontend   | Vanilla HTML, CSS, JavaScript |
| Fonts      | Playfair Display, DM Sans (Google Fonts) |
| File Upload| Multer |
| Email      | Nodemailer |
| Scheduler  | node-cron |
| Security   | Helmet, CORS, Rate Limiting |

---

## 📌 Adding Your Own Legal Documents to RAG

1. Add `.txt` or `.md` files to `Ai_Chatbot_Rag/knowledge_base/`
2. Name them descriptively (e.g., `criminal_law.txt`, `consumer_rights.txt`)
3. Restart the server — chatbot will automatically use them

---

## 🎯 Project Objectives

LEXASSIST demonstrates:
1. Full-stack Node.js/MongoDB web development
2. JWT-based authentication & authorization
3. RAG (Retrieval-Augmented Generation) AI integration
4. Role-based access control (RBAC)
5. RESTful API design
6. Responsive, production-grade UI/UX design

---

## 👨‍💻 Team

Built as a Minor Project — 2nd Year  
*For educational purposes. Not a substitute for professional legal advice.*

---

## 📄 License
MIT License — Free to use for educational purposes.
