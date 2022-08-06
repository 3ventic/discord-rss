FROM node:lts-alpine
WORKDIR /app
COPY *.json *.js ./
COPY static/ ./static/
COPY src/ ./src/
RUN npm i
RUN npm run sync
RUN npm run build
RUN npm run build:runner

FROM node:lts-alpine
WORKDIR /app
COPY --from=0 /app/*.js /app/*.json ./
COPY --from=0 /app/build/ ./build/
COPY --from=0 /app/runner/ ./runner/
RUN npm ci --omit=dev

ARG PORT=3000
EXPOSE $PORT

ENTRYPOINT ["npm", "start"]