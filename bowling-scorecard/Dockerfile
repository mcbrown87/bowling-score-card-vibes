FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY public ./public
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate

ENV HOST=0.0.0.0
ENV BROWSER=none

CMD ["npm", "start"]
