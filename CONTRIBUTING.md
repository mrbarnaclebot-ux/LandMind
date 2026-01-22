# Contributing to LandMind

Thank you for your interest in contributing to LandMind! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please:

- Be respectful of differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 20 or higher
- Docker and Docker Compose
- Rust toolchain (for smart contract work)
- Anchor CLI 0.30+ (for Solana development)
- A Solana wallet (Phantom or Solflare)

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/LandMind.git
   cd LandMind
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start infrastructure**
   ```bash
   docker-compose up -d
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local settings
   ```

5. **Initialize database**
   ```bash
   cd packages/server
   npm run db:push
   npm run db:seed
   cd ../..
   ```

6. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   npm run server

   # Terminal 2 - Frontend
   npm run client
   ```

## Making Changes

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Creating a Branch

```bash
# For a new feature
git checkout -b feature/your-feature-name

# For a bug fix
git checkout -b fix/issue-description

# For documentation
git checkout -b docs/what-you-are-documenting
```

## Commit Guidelines

We follow [Conventional Commits](https://conventionalcommits.org/) for clear commit history.

### Commit Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, semicolons, etc.) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process or auxiliary tool changes |

### Scopes

| Scope | Description |
|-------|-------------|
| `client` | Frontend changes |
| `server` | Backend changes |
| `contracts` | Smart contract changes |
| `db` | Database schema changes |
| `deps` | Dependency updates |

### Examples

```bash
feat(client): add heat map toggle to mobile header
fix(server): resolve mining tick calculation error
docs: update API reference in README
refactor(contracts): simplify Merkle proof verification
```

## Pull Request Process

### Before Submitting

1. **Ensure your code builds**
   ```bash
   npm run build --workspaces
   ```

2. **Run linting**
   ```bash
   npm run lint --workspaces
   ```

3. **Run tests**
   ```bash
   npm test --workspaces
   ```

4. **Update documentation** if needed

### PR Template

When opening a PR, include:

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests pass locally
```

### Review Process

1. Submit your PR against `develop` (or `main` for hotfixes)
2. Request review from maintainers
3. Address any feedback
4. Once approved, a maintainer will merge

## Code Style

### TypeScript/JavaScript

- Use TypeScript for all new code
- Use functional components with hooks in React
- Prefer `const` over `let`, avoid `var`
- Use async/await over raw promises
- Add types for all function parameters and returns

```typescript
// Good
async function fetchAgents(userId: string): Promise<Agent[]> {
  const response = await api.get(`/agents?userId=${userId}`);
  return response.data;
}

// Avoid
function fetchAgents(userId) {
  return api.get('/agents?userId=' + userId).then(r => r.data);
}
```

### React Components

```typescript
// Prefer function components with explicit types
interface AgentCardProps {
  agent: Agent;
  onSelect?: (id: string) => void;
}

export function AgentCard({ agent, onSelect }: AgentCardProps) {
  // Component logic
}
```

### CSS

- Use CSS modules or scoped styles
- Follow BEM naming convention
- Use CSS custom properties for theming

### Rust/Anchor

- Follow Rust naming conventions
- Add comments for complex logic
- Use `Result<T>` for fallible operations
- Include proper error types

## Testing

### Frontend Tests

```bash
cd packages/client
npm test
```

### Backend Tests

```bash
cd packages/server
npm test
```

### Smart Contract Tests

```bash
cd packages/contracts
anchor test
```

### Writing Tests

- Write tests for new features
- Update tests when modifying existing features
- Aim for meaningful test coverage, not just high numbers

## Documentation

### Code Comments

- Add JSDoc comments for exported functions
- Explain "why" not "what" in comments
- Keep comments up to date with code changes

```typescript
/**
 * Calculate weighted mining score for fee distribution.
 * Gold is weighted highest as it's the rarest resource.
 *
 * @param resources - User's mined resources
 * @returns Weighted score for fee calculation
 */
function calculateWeightedScore(resources: Resources): bigint {
  // Implementation
}
```

### README Updates

Update the README when:
- Adding new features
- Changing configuration options
- Modifying the API
- Updating dependencies significantly

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

---

Thank you for contributing to LandMind!
