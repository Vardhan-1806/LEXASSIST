# LEXASSIST — Deployment Guide (Railway + MongoDB Atlas)

## ─── Step 1: MongoDB Atlas (Free Database) ────────────────

1. Go to **mongodb.com/atlas** → Sign up free
2. Create project → Create cluster → Select **M0 Free** tier
3. Database Access → Add User → username + password (save these!)
4. Network Access → Add IP → **0.0.0.0/0** (allow all, important for Railway)
5. Connect → Drivers → Copy connection string
6. Replace `<password>` with your actual password
7. Your MONGO_URI looks like:
   `mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/lexassist`

## ─── Step 2: Push to GitHub ──────────────────────────────

```bash
cd LEXASSIST
git init
git add .
git commit -m "LEXASSIST v4 - Production Ready"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/LEXASSIST.git
git push -u origin main
```

## ─── Step 3: Deploy on Railway ───────────────────────────

1. Go to **railway.app** → Login with GitHub
2. New Project → Deploy from GitHub → Select LEXASSIST repo
3. Railway auto-detects Node.js and deploys!
4. Go to **Variables** tab and add ALL these:

```
MONGO_URI        = mongodb+srv://...your Atlas connection string...
JWT_SECRET       = lexassist_jwt_secret_minimum_32_characters_long
SESSION_SECRET   = lexassist_session_secret_another_random_string
NODE_ENV         = production
PORT             = 5000
CLIENT_URL       = (copy from Railway after first deploy - Settings tab)
EMAIL_USER       = yourgmail@gmail.com (optional)
EMAIL_PASS       = your_gmail_app_password (optional)
OPENAI_API_KEY   = sk-... (optional, chatbot works without it)
```

5. Go to **Settings** → **Networking** → **Generate Domain**
6. Copy your URL (like: lexassist-production.up.railway.app)
7. Add it back as `CLIENT_URL` in Variables
8. Railway will auto-redeploy

## ─── Step 4: Seed Database ───────────────────────────────

After deploying, run the seed command once in Railway:
- Go to your Railway project
- Click on your service
- Click **Railway Shell** or use **New Service → Terminal**

```bash
node DataBase_Ai_Data/seed.js
```

## ─── Step 5: Test Your Live App ──────────────────────────

Open your Railway URL:
```
https://lexassist-production.up.railway.app
```

Login with demo accounts:
- Citizen:  rajesh@example.com / User@123
- Lawyer:   priya@lexassist.com / Lawyer@123
- Admin:    admin@lexassist.com / Admin@123

## ─── Gmail Setup for Emails ──────────────────────────────

1. Gmail → Google Account → Security
2. Enable **2-Step Verification** (required)
3. Search for **App Passwords**
4. Select App: Mail → Select Device: Windows Computer
5. Click Generate → Copy the 16-character password
6. Paste in Railway as EMAIL_PASS

## ─── Common Errors & Fixes ───────────────────────────────

| Error | Fix |
|-------|-----|
| MongoDB connection timeout | Check 0.0.0.0/0 in Atlas Network Access |
| Session error on start | Make sure SESSION_SECRET is set in Variables |
| Emails not sending | Check Gmail App Password (not regular password!) |
| 404 on all pages | Check PORT=5000 and NODE_ENV=production |
| Build fails | Check package.json engines: node >=18.0.0 |

## ─── Costs ────────────────────────────────────────────────

| Service | Cost |
|---------|------|
| Railway | $5 free credit/month (enough for student project) |
| MongoDB Atlas M0 | FREE forever (512MB) |
| GitHub | FREE |
| OpenAI | Optional (chatbot works without it) |

**Total cost for student project: $0** ✅
