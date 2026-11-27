FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY api ./api
COPY src ./src
COPY database ./database
COPY docs ./docs
COPY tests ./tests
COPY ["README.md", "Fuentes de pruebas.pdf", "vercel.json", "./"]
COPY docker/server.mjs ./docker/server.mjs

USER node
EXPOSE 3000
CMD ["node", "docker/server.mjs"]
