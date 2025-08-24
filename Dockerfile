FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY frontend/package*.json ./frontend/

# Install dependencies
WORKDIR /app/frontend
RUN npm install

# Copy all frontend source code
COPY frontend/ ./

# Build the React app
RUN npm run build

# Install serve to run the built app
RUN npm install -g serve

# Expose port that Railway will use
EXPOSE 3000

# Start the app with SPA support
CMD ["serve", "-s", "build", "-l", "3000"]
