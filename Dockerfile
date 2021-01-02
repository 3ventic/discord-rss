FROM node:lts-alpine
WORKDIR /app
COPY . .
RUN npm i
RUN npm run build

FROM node:lts-alpine
WORKDIR /app
COPY --from=0 /app .
RUN npm ci

CMD ["npm", "start"]