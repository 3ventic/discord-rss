#!/bin/bash

TAG=$(git describe --tags --abbrev=0)

docker build -t docker.pkg.github.com/3ventic/discord-rss/discord-rss:$TAG .
docker push docker.pkg.github.com/3ventic/discord-rss/discord-rss:$TAG