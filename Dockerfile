FROM node:22-alpine

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server/ ./

USER node
EXPOSE 8080
CMD ["node", "server.js"]
