FROM docker.io/library/node:20-bookworm-slim

WORKDIR /app

# Install only production deps first for cache reuse.
COPY backend/package.json ./
RUN npm install --omit=dev

# Copy backend source.
COPY backend/src ./src
# NOTE: do NOT bake .env into the image — inject secrets at runtime via
# environment variables (docker run -e / compose env_file / k8s Secret).
# Copy frontend into the public dir so the API can serve the SPA.
COPY frontend ./public

# Expose the API port
EXPOSE 3000

# Start the Node.js API server
CMD ["node", "src/server.js"]