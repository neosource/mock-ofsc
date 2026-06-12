FROM docker.io/library/node:20-bookworm-slim

WORKDIR /app

# Install only production deps first for cache reuse.
COPY backend/package.json ./
RUN npm install --omit=dev

# Copy backend source.
COPY backend/src ./src
COPY backend/.env ./
# Copy frontend into the public dir so the API can serve the SPA.
COPY frontend ./public

# Expose the API port
EXPOSE 3000

# Start the Node.js API server
CMD ["node", "src/server.js"]
	});
}

try { db.createCollection("serviceRequests"); } catch (e) {}
try { db.createCollection("counters"); } catch (e) {}
db.serviceRequests.createIndex({ caseNumber: 1 }, { unique: true, name: "uniq_caseNumber" });
db.serviceRequests.createIndex({ createdAt: -1 }, { name: "recent_first" });
db.serviceRequests.createIndex({ "customer.phone": 1 }, { name: "by_phone" });
'

kill "$MONGOD_PID"
wait "$MONGOD_PID"

mongod \
	--dbpath /data/db \
	--bind_ip 127.0.0.1 \
	--auth \
	--port "$MONGO_PORT" \
	--logpath /var/log/mongodb/mongod.log \
	--logappend \
	>/dev/null 2>&1 &
MONGOD_PID=$!

until mongosh --quiet --port "$MONGO_PORT" \
	-u "$ROOT_USER" \
	-p "$ROOT_PASS" \
	--authenticationDatabase admin \
	--eval 'db.adminCommand({ ping: 1 }).ok' >/dev/null 2>&1; do
	if ! kill -0 "$MONGOD_PID" 2>/dev/null; then
		echo "mongod exited before becoming ready (auth phase)" >&2
		exit 1
	fi
	sleep 1
done

export MONGO_URI="${MONGO_URI:-mongodb://${APP_USER}:${APP_PASS}@127.0.0.1:${MONGO_PORT}/${APP_DB}?authSource=${APP_DB}}"

exec node src/server.js
EOF

RUN chmod +x /usr/local/bin/start-service-request.sh

ENV PORT=3000

VOLUME ["/data/db"]

EXPOSE 3000 27017

# Reset upstream Mongo image entrypoint and run our combined process manager.
ENTRYPOINT []
CMD ["/usr/local/bin/start-service-request.sh"]
