# 💻 XP Lab Trainer — Windows XP Systems Mastery

> A modern, gamified learning platform and terminal simulator for mastering Windows XP commands, system utilities, and administrator tools.

---

## 🚀 Features

- **42 Comprehensive Tasks**: Curated exercises covering **Run Dialog commands**, **Command Prompt utilities (`cmd`)**, and **GUI administration shortcuts**.
- **Interactive Practice Modes**:
  - 🗂️ **Flashcards**: Rapid recall training with self-grading and keyboard shortcuts (`1` Missed, `2` Knew it, `Space` Reveal).
  - ⌨️ **Type Command**: Real-time terminal input with instant regex syntax validation.
  - ⏱️ **Mock Exam**: Comprehensive timed challenge tracking personal records and delta comparison vs previous attempts.
  - 🖥️ **Terminal Sim**: Interactive Windows XP `C:\>` command prompt simulation with built-in command help and directory navigation.
  - 🎯 **Weak Tasks Drill**: Smart review queue automatically targeting your lowest-accuracy tasks.
- **Firebase Cloud Sync & Authentication**:
  - User registration (Username, Email, Password verification).
  - Real-time cloud sync with Firestore for streak tracking, study duration, task mastery, and mock exam personal records.
- **Guided Product Tour**: Interactive SVG spotlight overlay explaining every feature, metric, and training mode.
- **Rich Micro-Interactions & Animations**:
  - Smooth page view transitions and staggered card entries.
  - Correct answer pop (`ok`) & wrong answer shake (`shake`) feedback.
  - Confetti particle burst on 100% flawless score sessions.
  - Results screen animated roll-up counters.
  - Full `prefers-reduced-motion` accessibility support.
- **Dark & Light Mode**: Seamless theme toggling with tailored color schemes and automatic logo switching.
- **Analytics & Backup**: Searchable task performance database with JSON export and import capabilities.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, Custom CSS Design System
- **Backend / Cloud**: Firebase Modular Web SDK v10 (Auth, Firestore, Analytics)
- **Design System**: Apple iOS Human Interface Guidelines + Windows XP retro terminal aesthetic

---

## 📂 Project Structure

```
xp-lab/
├── assets/                  # Brand icons and logo assets (Light & Dark)
├── css/
│   └── styles.css           # Design system, iOS tokens, and animations
├── js/
│   ├── app.js               # Application logic, UI renderer, tour & animations
│   ├── data.js              # 42 Windows XP task definitions & regex rules
│   └── firebase-config.js   # Firebase Auth & Firestore sync engine
├── auth.html                # Dedicated Authentication entry page
├── index.html               # Main application entry point
├── xp-lab-trainer.html      # Standalone trainer view
├── package.json             # Project metadata & scripts
└── .gitignore               # Ignored dependencies & build files
```

---

## 🏁 Getting Started

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/nloqmanhn05/xp-lab.git
   cd xp-lab
   ```

2. **Open the project**:
   - Simply open `index.html` in your favorite modern browser, or
   - Use a local dev server (e.g. `npx serve .` or VS Code Live Server).

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| <kbd>Space</kbd> | Reveal flashcard answer / Check typing |
| <kbd>1</kbd> | Mark flashcard as *Missed* |
| <kbd>2</kbd> | Mark flashcard as *Knew it* |
| <kbd>Enter</kbd> | Submit typed command / Proceed to next task |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo previous task grade |
| <kbd>P</kbd> | Pause / Resume session timer |
| <kbd>Esc</kbd> | Exit active session / Dismiss modal |

---

## 📄 License

This project is licensed under the MIT License.
