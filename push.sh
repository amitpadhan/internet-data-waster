#!/bin/bash

# Internet Data Waster - Easy Push Script
# Usage: ./push.sh "your commit message"

if [ -f .git_token ]; then
    TOKEN=$(cat .git_token)
else
    echo "Error: .git_token file not found."
    exit 1
fi

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

echo "📤 Pushing to GitHub..."
git push https://amitpadhan:$TOKEN@github.com/amitpadhan/internet-data-waster.git main

echo "✅ Done!"
