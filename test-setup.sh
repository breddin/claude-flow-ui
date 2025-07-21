#!/bin/bash

# Test setup script for Codespaces deployment
echo "🔬 Testing Claude Flow UI Setup..."

# Check if all dependencies are installed
echo "📦 Checking dependencies..."
npm list --depth=0 | grep -E "(react|three|@react-three|@anthropic)" || {
    echo "❌ Missing dependencies"
    exit 1
}

# Test build process
echo "🏗️  Testing build..."
npm run build > /dev/null 2>&1 || {
    echo "❌ Build failed"
    exit 1
}

# Check if key files exist
echo "📁 Checking key files..."
for file in "src/App.tsx" "src/App.css" "start-dev.sh" ".devcontainer/devcontainer.json"; do
    if [[ ! -f "$file" ]]; then
        echo "❌ Missing file: $file"
        exit 1
    fi
done

# Test that ports are configured correctly
echo "🌐 Checking port configuration..."
grep -q "react-scripts start" package.json || {
    echo "❌ Development server not configured"
    exit 1
}

grep -q "9001" docker-compose.yml || {
    echo "❌ Production port not configured"
    exit 1
}

echo "✅ All tests passed! Claude Flow UI is ready for Codespaces deployment."
echo ""
echo "🚀 To launch in Codespaces:"
echo "   1. Push to GitHub"
echo "   2. Open in Codespaces"
echo "   3. Browser will auto-open to show the queen agent interface"
echo ""
echo "🔗 Development server: http://localhost:3000"
echo "🔗 Production server: http://localhost:9001"
