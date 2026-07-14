FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tsconfig.typecheck.json ./
COPY eslint.config.js ./
COPY .prettierrc.json ./
RUN npm ci
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/package.json /app/package-lock.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/apps ./apps
COPY --from=base /app/packages ./packages
COPY --from=base /app/scripts ./scripts
COPY --from=base /app/packages/db/migrations ./packages/db/migrations
EXPOSE 3000
CMD ["node", "scripts/railway-start.mjs"]
