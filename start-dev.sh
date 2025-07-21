#!/bin/bash

echo "🚀 Starting Claude Flow UI Development Server..."

# Start the React development server in the background
echo "📱 Starting React development server on port 3000..."
npm start &
REACT_PID=$!

# Wait a moment for React to initialize
sleep 5

# Also start the production build server on port 9001 for comparison
echo "🏭 Starting production server on port 9001..."
npm run build
npx serve -s build -l 9001 &
SERVE_PID=$!

echo "✅ Servers started:"
echo "   🔹 Development (hot reload): http://localhost:3000"
echo "   🔹 Production preview: http://localhost:9001"
echo ""
echo "🎯 Expected: Inactive queen agent waiting for input in 3D interface"
echo "   - Queen agent should be visible in the center"
echo "   - Status should show 'waiting' or 'idle'"
echo "   - Voice/text input panels should be available"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for interrupt
trap 'echo "🛑 Stopping servers..."; kill $REACT_PID $SERVE_PID 2>/dev/null; exit' INT
wait
