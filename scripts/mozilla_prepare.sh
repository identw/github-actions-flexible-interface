#!/usr/bin/env bash
rm -rf source
mkdir source
cp -rv ./img ./source/
cp -rv ./mozilla ./source/
cp -rv ./google ./source/
cp -rv ./src ./source/
cp -fv  ./package*.json ./source/
cp -fv ./version ./source/
cp -fv ./webpack.config.js ./source/
cp -fv ./scripts/files/mozilla/* ./source/

cd source
zip -r ../source.zip .
cd ..

rm -rf source
