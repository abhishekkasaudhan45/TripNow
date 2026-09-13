# 🌍 TripNow — AI-Powered Travel Planner

An advanced, full-stack AI travel planning web application that generates personalized itineraries in seconds. Built with a sleek glassmorphic user interface, secure token-based authentication, and a robust backend architecture.

🔗 **Live Demo:** [https://tripnow.abhishektech.me](https://tripnow.abhishektech.me)  
🛠️ **Status:** Production Ready

---

## ✨ Features

* **🤖 AI Itinerary Generation:** Leverages Google Gemini AI to generate personalized, day-by-day travel itineraries based on destination, budget, and travel dates.
* **🎨 Glassmorphism UI:** Modern, accessible interface built with Tailwind CSS, featuring smooth gradients, micro-interactions, and custom loading skeletons.
* **🔒 Secure Authentication:** Complete authentication flow using JSON Web Tokens (JWT), protected routes, role-based admin authorization, and rate-limited endpoints.
* **⚡ Performance Optimized:** Frontend code-splitting using `React.lazy` and `Suspense`, coupled with Gzip compression on the Express backend.
* **🎛️ User Dashboard & Admin Panels:** Dedicated protected views for users to manage saved trips and an administrative dashboard for platform management.
* **💾 Persistent Trip Storage:** Generated itineraries are validated and stored in MongoDB Atlas, allowing users to review their travel plans anytime.
* **📋 Structured AI Responses:** Strict JSON schema generation providing daily activities, food recommendations, budget breakdowns, travel tips, and accommodation tiers.

---

## 🛠️ Tech Stack

### Frontend
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)

### Backend & Database
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=539ee0)

### AI & Hosting
![Google Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

---

## 🚀 Getting Started (Local Setup)

Follow these steps to configure and run the project locally.

### Prerequisites
* Node.js v18+ installed
* MongoDB local instance or MongoDB Atlas cluster URI
* Google AI Studio API key

---

### 1. Configure Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
NODE_ENV=development
PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=2h

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_me

GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.6-flash

CLIENT_URL=http://localhost:5173
