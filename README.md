# 🚀 BigQuery Release Notes Radar & X/Twitter Sharer

A modern web application built with **Python Flask** and **Vanilla HTML, CSS, JavaScript** that fetches live release notes from [Google Cloud BigQuery Official Feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml), parses them into category updates, and lets you tweet any release note with a single click.

![BigQuery Radar Screenshot](https://img.shields.io/badge/BigQuery-Release%20Notes-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- **Live Feed Parsing**: Fetches and parses the official BigQuery RSS Atom feed in real-time.
- **Refresh Button with Spinner**: On-demand manual feed refresh with animated loading spinner and server-side caching (5-minute TTL).
- **Category Filter Pills**: Filter updates by category (`Feature`, `Changed`, `Deprecated`, `Fix`, `Announcement`).
- **Real-time Search Bar**: Search notes by keyword, title, date, or category.
- **Dark & Light Mode**: Modern UI design system with glassmorphism cards and persistent theme selection.
- **Interactive X / Twitter Composer Modal**:
  - Pre-formulated tweet drafts under 280 characters with hashtags (#BigQuery, #GoogleCloud, #DataEngineering).
  - Live character progress bar indicator.
  - Interactive hashtag chips.
  - Direct 1-click **Post to X (Twitter)** web intent launcher (`https://twitter.com/intent/tweet?text=...`).

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Python 3, Flask, BeautifulSoup4, Requests, XML ElementTree.
- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism, custom HSL color system), ES6 JavaScript.
- **Deployment & Repo**: Git, GitHub CLI (`gh`).

---

## 🚀 Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sachinm207/event-talks-app.git
   cd event-talks-app
   ```

2. **Set up Virtual Environment & Install Dependencies**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install flask requests beautifulsoup4
   ```

3. **Start the Flask Application**:
   ```bash
   python3 app.py
   ```

4. Open your browser and navigate to `http://localhost:5000`.

---

## 📝 License
MIT License
