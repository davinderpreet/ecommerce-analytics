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

# Expose port
EXPOSE 3000

# Use correct serve syntax with port fallback
CMD ["sh", "-c", "serve -s build -l ${PORT:-3000}"]
