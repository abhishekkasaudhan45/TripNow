# 🌍 TripNow — AI-Powered Travel Planner

An advanced, full-stack AI travel planning web application that generates personalized itineraries in seconds. Built with a sleek glassmorphic user interface, secure token-based authentication, and a robust backend architecture.

🔗 **[Live Demo](https://abhishektech.me)** | 🛠️ **Status: Production Ready**

---

## ✨ Features

* **🤖 AI Itinerary Generation:** Leverages high-performance AI via the Groq API to construct optimized, day-by-day travel schedules based on user preferences.
* **🎨 Glassmorphism UI:** A modern, accessible interface built with Tailwind CSS, utilizing smooth gradients, micro-interactions, and custom loading skeletons.
* **🔒 Secure Authentication:** Complete authentication flow implemented via JSON Web Tokens (JWT) with HTTP-only cookies and protected route middleware.
* **⚡ Performance Optimized:** Engineered with lazy loading on the frontend (`React.lazy` and `Suspense`) and Gzip compression on the backend Express application.
* **🎛️ User Dashboard & Admin Panels:** Distinct, protected views for users to manage saved trips and a strict administrative gateway for platform oversight.

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
![Groq](https://img.shields.io/badge/Groq_API-orange?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

---

## 🚀 Getting Started (Local Development)

Follow these steps to set up and run the project locally on your machine.

### Prerequisites
* Node.js installed (v18+ recommended)
* MongoDB instance (Local or Atlas)
* Groq API Key

### 1. Clone the Repository
```bash
git clone [https://github.com/ab_kasaudhan/travelx.git](https://github.com/ab_kasaudhan/tripnow.git)
cd tripnow
2. Configure Environment Variables
Create a .env file in your backend directory:

Code snippet
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
GROQ_API_KEY=your_groq_api_key
CLIENT_URL=http://localhost:5173
Create a .env file in your frontend directory:

Code snippet
VITE_API_URL=http://localhost:5000
3. Install & Run
Start the Backend Server:

Bash
cd backend
npm install
npm start
Start the Frontend App:

Bash
cd ../frontend
npm install
npm run dev
Open your browser to http://localhost:5173 to view the app!

🗺️ Roadmap & Upcoming Upgrades
[ ] Export to PDF & Calendar: Seamless generation of clean PDF itinerary summaries and direct calendar syncing (Google Calendar/iCal).

[ ] Interactive Map Integration: Embedding custom maps using Leaflet or Mapbox to visually display trip coordinates next to descriptions.