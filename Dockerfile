# Anthropic Secure Container Specification
# Based on: https://docs.anthropic.com/en/docs/claude-code/devcontainer

FROM node:20

ARG TZ
ENV TZ="$TZ"

# Install basic development tools and security components
RUN apt update && apt install -y \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  curl \
  wget

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist command history
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set DEVCONTAINER environment variable
ENV DEVCONTAINER=true

# Create workspace and config directories with proper permissions
RUN mkdir -p /workspace /home/node/.claude /app && \
  chown -R node:node /workspace /home/node/.claude /app

# Set working directory
WORKDIR /app

# Install git-delta for better diff viewing
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/0.18.2/git-delta_0.18.2_${ARCH}.deb" && \
  dpkg -i "git-delta_0.18.2_${ARCH}.deb" && \
  rm "git-delta_0.18.2_${ARCH}.deb"

# Set up non-root user for build process
USER node

# Configure npm global directory
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh
ENV SHELL=/bin/zsh

# Install zsh with productivity enhancements
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.2.0/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Install Claude Code SDK globally
RUN npm install -g @anthropic-ai/claude-code

# Copy package.json and package-lock.json
COPY --chown=node:node package*.json ./

# Install project dependencies (including Claude Code SDK for integration)
RUN npm ci

# Copy source code
COPY --chown=node:node . .

# Build the application
RUN npm run build

# Copy firewall script and set up security
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall

# Production stage with nginx and security
FROM nginx:alpine

# Install security tools in production image
RUN apk add --no-cache \
  iptables \
  ip6tables \
  ipset \
  curl \
  jq

# Copy built assets from build stage
COPY --from=0 /app/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy and set up firewall script for production
COPY init-firewall.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-firewall.sh

# Create non-root user for production
RUN addgroup -g 1001 appuser && \
  adduser -D -u 1001 -G appuser appuser

# Expose port 9001
EXPOSE 9001

# Initialize firewall and start nginx with security
CMD ["/bin/sh", "-c", "/usr/local/bin/init-firewall.sh && nginx -g 'daemon off;'"]
