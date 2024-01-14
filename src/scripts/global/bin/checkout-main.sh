#!/bin/bash

# Fail if there are unsaved changes
if ! git diff-index --quiet HEAD --; then
    echo "You have unsaved changes. Please commit or stash them first."
    exit 1
fi

# Save the name of the current branch
current_branch=$(git rev-parse --abbrev-ref HEAD)

if [[ "$current_branch" = "main" || "$current_branch" = "master" ]]; then
  echo "Error: You are already on branch $branch."
  exit 1
fi

# Force checkout main or master depending on which one exists
if git show-ref --verify --quiet refs/heads/main; then
    git checkout -f main
elif git show-ref --verify --quiet refs/heads/master; then
    git checkout -f master
else
    echo "Neither main nor master branch exists."
    exit 1
fi

# Delete the old branch
if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ]; then
    git branch -D "$current_branch"
else
    echo "Cannot delete main or master branch."
    exit 1
fi
