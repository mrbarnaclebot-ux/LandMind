# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of LandMind seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

**security@landmind.io** (or create a private security advisory on GitHub)

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., smart contract bug, authentication bypass, XSS)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it
- Any potential mitigations you've identified

### Response Timeline

- **Initial Response:** Within 48 hours
- **Status Update:** Within 7 days
- **Resolution Target:** Within 30 days for critical issues

### Smart Contract Security

For vulnerabilities related to our Solana smart contracts:

1. **DO NOT** exploit the vulnerability on mainnet
2. Test reproduction on devnet only
3. Include transaction signatures from devnet in your report
4. Specify if the issue affects devnet, mainnet, or both

### Scope

The following are in scope:

- Smart contracts in `packages/contracts/`
- Backend API in `packages/server/`
- Frontend authentication in `packages/client/`
- Infrastructure configuration

The following are out of scope:

- Third-party services (Solana, Helius, etc.)
- Issues in dependencies (report to the respective projects)
- Social engineering attacks
- Physical security

### Recognition

We appreciate the security research community's efforts. Reporters of valid vulnerabilities will be:

- Credited in our security acknowledgments (if desired)
- Potentially eligible for bug bounty rewards (TBD)

### Safe Harbor

We consider security research and vulnerability disclosure activities conducted consistent with this policy to be:

- Authorized concerning any applicable anti-hacking laws
- Authorized concerning any relevant anti-circumvention laws
- Exempt from restrictions in our Terms of Service that would interfere with conducting security research

We will not pursue civil action or initiate a complaint for accidental, good-faith violations of this policy.

## Security Best Practices

For users and developers:

### Users

- Always verify you're on the official LandMind website
- Never share your wallet seed phrase
- Use hardware wallets for large holdings
- Verify transaction details before signing

### Developers

- Never commit secrets to version control
- Use environment variables for sensitive configuration
- Follow the principle of least privilege
- Keep dependencies updated
- Review changes to smart contracts carefully

## Contact

For general security questions (non-vulnerabilities), you can open a GitHub Discussion.
