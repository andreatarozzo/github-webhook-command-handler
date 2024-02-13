ARG OPTIC_VERSION="v0.54.3"

# Build stage: Install all dependencies and build the application
FROM node:20.6.0-bookworm AS builder
WORKDIR /home/node/app

# Copy package files and install dependencies
COPY package*.json ./
RUN yarn install

# Copy source code and build the application
COPY . .
RUN yarn build

# Production stage: Start with a fresh image and copy over the compiled code
FROM node:20.6.0-bookworm
ENV NODE_ENV=production
WORKDIR /home/node/app

# Installing optic as an example
RUN sh -c "$(curl -Ls https://install.useoptic.com/install.sh)" -- "$OPTIC_VERSION" /usr/local/bin

# Copy production dependencies and the built code
COPY package*.json ./
RUN yarn install --production --frozen-lockfile && yarn cache clean 
COPY --from=builder /home/node/app/dist ./dist

# This is ok for local testing, for a CI process through, for example, GitHub Actions, the file can be injected during the run
# Alternatively env variables could be passed with the run command -> docker run -e MY_SECRET_KEY=MY_SECRET_VALUE
COPY ./.env ./.env

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["yarn", "start"]
