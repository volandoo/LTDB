# FROM --platform=linux/amd64 ubuntu:22.04
FROM ubuntu:22.04

# Install necessary packages including Node.js
RUN apt-get update && apt-get install -y \
    build-essential \
    qt6-base-dev \
    libqt6websockets6-dev \
    cmake \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_23.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy the project files
COPY . .

# Build the project
RUN mkdir build && cd build \
    && qmake6 ../ltdb.pro CONFIG+=release \
    && make


# Expose the WebSocket port
EXPOSE 8080

# Set the entrypoint
ENTRYPOINT [ "./build/ltdb" ]