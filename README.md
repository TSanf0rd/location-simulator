# Hierarchical Location Management Simulator

**CS 6604 — Mobile & Distributed Computing — HW 1**

An interactive web-based simulator demonstrating hierarchical location management schemes in mobile networks. Built with React.
### live at `https:/TSanf0rd.github.io/location-simulator`

## Features

### 1. Hierarchical Location Scheme
- Dynamic tree generation with configurable depth and branching factor
- Animated call tracing from caller → LCA → callee
- Location update (user movement) with path visualization
- Real-time hop cost tracking

### 2. Forwarding Pointers (Tree-Level Based)
- Adjustable forwarding pointer level
- Visual pointer arrows between tree nodes
- Demonstrates how pointers reduce update cost at the expense of search cost
- Pointer purging support
- Shows how many nodes at each level benefit from shortcuts

### 3. Replication in Hierarchical Scheme
- Working set replication based on the condition: α·C^(x,j) ≥ β·U^x
- Configurable call rate (α) and move rate (β)
- Visual replica indicators on tree nodes
- Automatic replica invalidation on user movement

### 4. Update vs Search Cost Comparison
- Monte Carlo simulation across multiple CMR (Call-to-Mobility Ratio) values
- Side-by-side bar charts comparing all three schemes
- Basic hierarchical, forwarding pointers, and replication compared

## Setup

```bash
# Install dependencies
npm install

# Run locally
npm start

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```
## GitHub Pages

Simulator will be live at `https:/TSanf0rd.github.io/location-simulator`

## Key Concepts

- **CMR (Call-to-Mobility Ratio)**: λ/σ — ratio of incoming calls to user movements
- **LCA (Least Common Ancestor)**: The node where search paths from caller and callee converge in the tree
- **Forwarding Pointer**: A shortcut pointer set at a specific tree level to avoid full tree traversal during updates
- **Replication**: Copying location data to nodes that frequently query a user, reducing search cost


Run the simulator and use the Auto-Simulate button to watch the system in action with randomized calls and movements.
