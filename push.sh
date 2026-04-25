#!/bin/bash

# Internet Data Waster - Easy Push Script (SSH Mode)
# Usage: ./push.sh "your commit message"

if [ -z "$1" ]
then
    echo "Error: Please provide a commit message."
    echo "Usage: ./push.sh \"your commit message\""
    exit 1
fi

echo "🚀 Staging changes..."
git add .

echo "📝 Committing with message: $1"
git commit -m "$1"

echo "📤 Pushing to GitHub via SSH..."
git push origin main

echo "✅ Done!"
