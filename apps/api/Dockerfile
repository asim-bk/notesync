FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/note-domain/package.json packages/note-domain/package.json
COPY packages/crypto-core/package.json packages/crypto-core/package.json

RUN npm ci

COPY . .

RUN npm run build
RUN npm --workspace @notesync/api run prisma:generate

EXPOSE 4000

CMD ["npm", "--workspace", "@notesync/api", "run", "start"]
