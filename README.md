# AWKT-LD Database AI

Universal Multi-AI Database Analytics Assistant

## 🚀 Overview

AWKT-LD is an AI-powered database analytics platform that:

- Connects to PostgreSQL
- Uses multiple AI providers (Gemini, OpenAI, DeepSeek)
- Generates SQL automatically
- Detects visualization type
- Renders KPI / Chart / Table dynamically
- Provides AI insights

---

## 🧠 Multi-AI Architecture

The system uses:

- Google Gemini
- OpenAI (ChatGPT)
- DeepSeek

Parallel execution:
All providers run simultaneously.
First successful response wins.

Forced execution supported:
- "use chatgpt"
- "use deepseek"

---

## 📊 Smart Visualization

Auto-detects:
- KPI (single number)
- Line chart
- Bar chart
- Pie chart
- Table fallback

---

## 🔐 Security

- SQL Safety Guard
- SELECT-only enforcement
- Schema awareness
- MCP authentication header

---

## ⚙️ Environment Variables

Create `.env.local`:

DATABASE_URL=
GEMINI_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
MCP_API_KEY=erp-system-123

## 🏗 Architecture

User
↓
Next.js API
↓
Multi-AI Router
↓
SQL Validation
↓
PostgreSQL
↓
Smart Visualization


## 📈 Features

- Parallel AI execution
- Visualization detection
- Drill-down ready
- Insight generation
- Chart auto-rendering
- Live schema memory

---

## 🛠 TODO (Recommended Next Upgrades)

### 🔥 High Priority
- AI voting system (3 SQL outputs → choose best)
- Query caching
- Provider health monitoring
- Rate limit fallback logic
- Auto-retry on DB disconnection

### 🚀 Advanced Features
- AI cost optimization routing
- Enterprise RBAC
- Query history tracking
- Client-level isolation
- AI performance scoring

### 🤖 Future AI Features
- Natural language explanation generation
- Predictive analytics
- AI anomaly detection
- AI trend forecasting

### 🏢 Enterprise Expansion
- Multi-database support
- Data warehouse integration
- Vector DB integration
- Custom fine-tuned LLM

---

## 🧠 Can I Train My Own LLM?

Yes.

Options:
1. Fine-tune OpenAI (if allowed)
2. Train local LLM (Llama / Mistral)
3. Build retrieval-based memory system
4. Use conversation logs as dataset

⚠️ Always check data privacy compliance.

---

## 👑 Vision

Turn AWKT-LD into:

Enterprise AI Data Brain

- Multi-AI orchestration
- Live data intelligence
- Client-ready SaaS

---

Built with:
- Next.js
- Prisma
- PostgreSQL
- Gemini
- OpenAI
- DeepSeek
- Recharts