"""
LEXASSIST — Kaggle API Setup Helper
=====================================
Run this FIRST before train_rag.py if you don't have Kaggle API key
"""

import os, sys, json
from pathlib import Path

print("""
╔══════════════════════════════════════════════════════════╗
║   LEXASSIST — Kaggle API Setup                          ║
╚══════════════════════════════════════════════════════════╝

To download the Vakil dataset, you need a FREE Kaggle account
and API key. Follow these steps:

STEP 1 — Create free Kaggle account
  → Go to: https://www.kaggle.com
  → Click Sign Up (free)

STEP 2 — Get your API key
  → After login, click your profile photo (top right)
  → Click "Settings"
  → Scroll to "API" section
  → Click "Create New Token"
  → A file called "kaggle.json" will download

STEP 3 — Place the API key file
  The kaggle.json file looks like this:
  {"username":"yourusername","key":"yourkey123..."}
""")

# Detect OS and show correct path
if sys.platform == 'win32':
    kaggle_dir = Path.home() / '.kaggle'
    print(f"  On Windows, place it here:")
    print(f"  C:\\Users\\{os.getenv('USERNAME', 'YourName')}\\.kaggle\\kaggle.json")
else:
    kaggle_dir = Path.home() / '.kaggle'
    print(f"  On Mac/Linux, place it here:")
    print(f"  ~/.kaggle/kaggle.json")

print(f"""
STEP 4 — Run the training script
  python train_rag.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do you already have your kaggle.json file? 
Enter the full path to it and I'll set it up automatically:
(Press Enter to skip if already set up)
""")

path_input = input("Path to kaggle.json (or press Enter to skip): ").strip()

if path_input:
    src = Path(path_input.strip('"').strip("'"))
    if src.exists():
        kaggle_dir.mkdir(parents=True, exist_ok=True)
        dst = kaggle_dir / 'kaggle.json'
        import shutil
        shutil.copy(src, dst)
        # Set permissions on Linux/Mac
        if sys.platform != 'win32':
            os.chmod(dst, 0o600)
        print(f"\n✅ kaggle.json copied to {dst}")
        
        # Verify it's valid JSON
        try:
            data = json.loads(dst.read_text())
            if 'username' in data and 'key' in data:
                print(f"✅ API key valid for user: {data['username']}")
                print(f"\n🚀 You're ready! Now run:")
                print(f"   python train_rag.py")
            else:
                print("⚠️  File doesn't look like a valid kaggle.json")
        except:
            print("⚠️  Could not read the file. Make sure it's valid JSON.")
    else:
        print(f"❌ File not found: {src}")
        print("Please check the path and try again.")
else:
    # Check if already set up
    kaggle_json = kaggle_dir / 'kaggle.json'
    if kaggle_json.exists():
        try:
            data = json.loads(kaggle_json.read_text())
            print(f"\n✅ Kaggle API already configured for: {data.get('username','unknown')}")
            print(f"\n🚀 Run: python train_rag.py")
        except:
            print("\n⚠️ kaggle.json exists but might be invalid. Re-download from Kaggle.")
    else:
        print(f"\n⚠️ No kaggle.json found at {kaggle_dir}")
        print("Please follow Steps 1-3 above first.")
