#!/bin/sh

USER="your_user_name"
MACHINE="any_CSE_Labs_Linux_machine"
DIRECTORY=".www/Assignment-5/"

rm -rf dist/assets
cp -r assets dist/assets
rsync -avr --delete --chmod=D701,F644 dist/ "$USER"@"$MACHINE":"$DIRECTORY"