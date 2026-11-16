# Single image: builds the React app, then runs the Node server that serves API + app.
FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json ./server/
RUN npm --prefix server install --omit=dev
COPY server/ ./server/
COPY --from=web /app/web/dist ./web/dist
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "server/src/index.js"]
