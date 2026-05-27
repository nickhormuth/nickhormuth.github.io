FROM node:22-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --silent

FROM node:22-slim AS run
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install --silent tsx@4
ENTRYPOINT ["npx", "tsx"]
