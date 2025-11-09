FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY public ./public
COPY src ./src

ENV HOST=0.0.0.0
ENV BROWSER=none

CMD ["npm", "start"]
