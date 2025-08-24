FROM node:18-alpine

# Set working directory to frontend
WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source
COPY frontend/ ./

# Build the app
RUN npm run build

# Install serve globally
RUN npm install -g serve

# Expose the port Railway expects
EXPOSE $PORT

# Start the app on Railway's dynamic port
CMD ["sh", "-c", "serve -s build -l $PORT"]
