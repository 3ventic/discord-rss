FROM node:lts-alpine
WORKDIR /app
COPY . .
RUN npm ci --production
RUN npm run build

CMD ["npm", "start"]