#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

echo "Initializing Anthropic secure container firewall..."

# Check if running with sufficient privileges
if [ "$EUID" -ne 0 ]; then
    echo "Firewall script must be run as root"
    exit 1
fi

# Flush existing rules and delete existing ipsets
iptables -F 2>/dev/null || true
iptables -X 2>/dev/null || true
iptables -t nat -F 2>/dev/null || true
iptables -t nat -X 2>/dev/null || true
iptables -t mangle -F 2>/dev/null || true
iptables -t mangle -X 2>/dev/null || true
ipset destroy allowed-domains 2>/dev/null || true

# First allow DNS and localhost before any restrictions
echo "Setting up basic network access..."

# Allow outbound DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# Allow inbound DNS responses
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Allow outbound SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# Allow inbound SSH responses
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Create ipset with CIDR support
echo "Creating IP allowlist..."
ipset create allowed-domains hash:net

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
if command -v curl >/dev/null 2>&1; then
    gh_ranges=$(curl -s https://api.github.com/meta || echo "")
else
    echo "WARNING: curl not available, skipping GitHub IP ranges"
    gh_ranges=""
fi

if [ -n "$gh_ranges" ] && command -v jq >/dev/null 2>&1; then
    if echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null 2>&1; then
        echo "Processing GitHub IPs..."
        while read -r cidr; do
            if [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
                echo "Adding GitHub range $cidr"
                ipset add allowed-domains "$cidr" 2>/dev/null || true
            fi
        done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | sort -u)
    fi
fi

# Resolve and add other allowed domains for Claude Flow UI
for domain in \
    "registry.npmjs.org" \
    "api.anthropic.com" \
    "sentry.io" \
    "statsig.anthropic.com" \
    "statsig.com" \
    "claude.ai" \
    "anthropic.com"; do
    
    echo "Resolving $domain..."
    if command -v dig >/dev/null 2>&1; then
        ips=$(dig +short A "$domain" 2>/dev/null || echo "")
    elif command -v nslookup >/dev/null 2>&1; then
        ips=$(nslookup "$domain" 2>/dev/null | grep -E '^Address:' | awk '{print $2}' || echo "")
    else
        echo "WARNING: No DNS lookup tool available, skipping $domain"
        continue
    fi
    
    if [ -n "$ips" ]; then
        while read -r ip; do
            if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                echo "Adding $ip for $domain"
                ipset add allowed-domains "$ip" 2>/dev/null || true
            fi
        done < <(echo "$ips")
    else
        echo "WARNING: Failed to resolve $domain"
    fi
done

# Get host IP from default route for container communication
echo "Detecting host network..."
HOST_IP=$(ip route | grep default | cut -d" " -f3 2>/dev/null || echo "")
if [ -n "$HOST_IP" ]; then
    HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
    echo "Host network detected as: $HOST_NETWORK"
    
    # Set up host network access
    iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
    iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT
fi

# Set default policies to DROP (security by default)
echo "Applying security policies..."
iptables -P INPUT DROP 2>/dev/null || true
iptables -P FORWARD DROP 2>/dev/null || true
iptables -P OUTPUT DROP 2>/dev/null || true

# Allow established connections for already approved traffic
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow only specific outbound traffic to allowed domains
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Allow HTTP/HTTPS traffic on port 9001 for the application
iptables -A INPUT -p tcp --dport 9001 -j ACCEPT
iptables -A OUTPUT -p tcp --sport 9001 -j ACCEPT

echo "Firewall configuration complete"

# Verify firewall is working
echo "Verifying firewall rules..."
if command -v curl >/dev/null 2>&1; then
    # Test that blocked sites are actually blocked
    if curl --connect-timeout 3 -s https://example.com >/dev/null 2>&1; then
        echo "WARNING: Firewall verification failed - was able to reach blocked site"
    else
        echo "✓ Firewall verification passed - blocked sites are inaccessible"
    fi
    
    # Test that allowed sites are accessible
    if curl --connect-timeout 5 -s https://api.anthropic.com >/dev/null 2>&1; then
        echo "✓ Firewall verification passed - Anthropic API is accessible"
    else
        echo "WARNING: Firewall verification failed - unable to reach Anthropic API"
    fi
else
    echo "✓ Firewall rules applied (verification skipped - no curl available)"
fi

echo "Secure container initialization complete"
