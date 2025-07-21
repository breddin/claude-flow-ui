# Claude Flow UI - Documentation Index

This document provides an organized index of all guidance documentation for the Claude Flow UI project.

## 📋 **Guidance Documentation (Prefix: _)**

All guidance and architectural documentation files are prefixed with an underscore for easy identification and organization.

### **🧠 Core Architecture & Memory**
- **`_API_AGENT_MEMORY.md`** - AI Agent Memory Architecture (5-layer system)
- **`_API_MIGRATION_ANALYSIS.md`** - Migration from CLI to API-centric architecture
- **`_CLAUDE-FLOW-README.md`** - Claude Flow project overview and context

### **🔧 Technical Integration**
- **`_CLAUDE_CODE_SDK_INTEGRATION.md`** - Claude Code SDK integration guide
- **`_SECURITY.md`** - Anthropic secure container implementation
- **`_DOCUMENTATION_INDEX.md`** - This index file (documentation organization)

### **📊 Project Documentation**
- **`README.md`** - Project overview and getting started guide
- **`CLAUDE.md`** - Claude Code configuration and development rules
- **`package.json`** - Project dependencies and scripts
- **`tsconfig.json`** - TypeScript configuration

## 🏗️ **Container & Deployment**

### **Docker Configuration**
- **`Dockerfile`** - Anthropic secure container specification
- **`docker-compose.yml`** - Production deployment configuration
- **`nginx.conf`** - Nginx configuration for React app
- **`init-firewall.sh`** - Security firewall initialization

### **Development Environment**
- **`.devcontainer/devcontainer.json`** - VS Code development container
- **`.env.example`** - Environment variables template
- **`docker-run.sh`** - Simple Docker execution script
- **`docker-compose-run.sh`** - Docker Compose management script

## 🎯 **Quick Navigation**

### **For New Developers**
1. Start with `README.md` - Basic project overview
2. Read `_SECURITY.md` - Security implementation
3. Review `_CLAUDE_CODE_SDK_INTEGRATION.md` - SDK integration
4. Check `.env.example` for environment setup

### **For Architects**
1. `_API_AGENT_MEMORY.md` - Memory architecture design
2. `_API_MIGRATION_ANALYSIS.md` - Migration strategy
3. `_SECURITY.md` - Security architecture
4. `_CLAUDE_CODE_SDK_INTEGRATION.md` - Technical integration

### **For DevOps**
1. `Dockerfile` - Container specification
2. `docker-compose.yml` - Deployment configuration
3. `init-firewall.sh` - Security setup
4. `_SECURITY.md` - Security implementation guide

## 🔗 **File Naming Convention**

```
Project Structure:
claude-flow-ui/
├── README.md                           # Main project documentation
├── CLAUDE.md                           # Claude Code configuration
├── _API_AGENT_MEMORY.md               # Guidance: Memory architecture
├── _API_MIGRATION_ANALYSIS.md         # Guidance: Migration strategy
├── _CLAUDE-FLOW-README.md             # Guidance: Project context  
├── _CLAUDE_CODE_SDK_INTEGRATION.md    # Guidance: SDK integration
├── _DOCUMENTATION_INDEX.md            # Guidance: Documentation index
├── _SECURITY.md                       # Guidance: Security implementation
├── package.json                       # Project configuration
├── Dockerfile                         # Container specification
├── docker-compose.yml                 # Deployment configuration
├── .devcontainer/                     # VS Code dev environment
│   └── devcontainer.json
├── src/                               # Source code
├── public/                            # Static assets
└── ...
```

## 📝 **Document Categories**

### **🔹 Underscore Prefix (_)**: Guidance Documents
- Architecture decisions
- Implementation guides  
- Security specifications
- Integration instructions
- Migration strategies

### **🔹 No Prefix**: Standard Project Files
- README.md (main documentation)
- Configuration files (package.json, tsconfig.json)
- Build/deployment files (Dockerfile, docker-compose.yml)

## 🎉 **Benefits of This Organization**

1. **📁 Clear Separation**: Guidance docs vs. standard project files
2. **🔍 Easy Discovery**: All guidance docs grouped together
3. **📚 Logical Ordering**: Documents appear first in directory listings
4. **🛠️ Tool Friendly**: Build tools naturally exclude `_*` files
5. **👥 Team Clarity**: New developers know where to find guidance

This organization ensures that all architectural decisions, implementation guides, and technical documentation are easily discoverable while keeping standard project files clearly separated.
