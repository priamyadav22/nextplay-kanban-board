# 🚀 NextPlay Kanban Board

A full-stack Kanban board built with React, Vite, and Supabase, featuring drag-and-drop task management, real-time persistence, and a polished productivity-focused UI.

---

## 🔗 Live Demo

👉 https://kanban-board-psi-weld.vercel.app

---

## ✨ Features

- Anonymous authentication (no login required)
- Secure per-user data using Supabase Row-Level Security (RLS)
- Drag-and-drop task movement across columns
- Persistent backend (Supabase)
- Task creation with:
  - title
  - description
  - priority levels
  - due dates
- Smart due date highlighting (normal / soon / overdue)
- Delete task functionality
- Board-level stats (total, completed, overdue)
- Clean, responsive UI with modern design principles

---

## 🧠 Technical Decisions

- **Supabase (Backend):**  
  Used for authentication and database. RLS policies ensure each user can only access their own tasks.

- **Anonymous Auth:**  
  Allows instant onboarding without requiring sign-up, improving user experience.

- **Drag-and-Drop:**  
  Implemented using `@hello-pangea/dnd`, with backend updates on drop to persist state.

- **State Management:**  
  React state is synced with Supabase via fetch after mutations (create, update, delete).

- **UI/UX Focus:**  
  Designed with a clean productivity aesthetic:
  - single accent color
  - soft column backgrounds
  - visual hierarchy in cards
  - urgency-based due date styling

---

## 🔐 Security

- Supabase Row-Level Security (RLS) ensures:
  - users can only read their own tasks
  - users can only modify their own tasks

---

## ⚙️ Tech Stack

- React (Vite)
- TypeScript
- Supabase
- @hello-pangea/dnd
- Vercel (deployment)

---

## 📌 Future Improvements

- Edit task functionality
- Search / filtering
- User accounts (email login)
- Real-time collaboration
