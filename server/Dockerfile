FROM node:22-alpine
RUN apk add --no-cache git python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 8787
CMD ["npm","start"]
