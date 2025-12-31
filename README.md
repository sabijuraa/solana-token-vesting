# Token Vesting on Solana

A complete token vesting protocol built with Anchor framework on Solana, featuring linear vesting with cliff periods and admin revocation capabilities.

## 🎯 Features

- **Linear Vesting**: Tokens unlock gradually over time
- **Cliff Period**: No tokens available until cliff ends
- **Admin Revocation**: Admin can reclaim unvested tokens
- **Beneficiary Claims**: Claim vested tokens anytime after cliff
- **PDA-Based Security**: All accounts are Program Derived Addresses
- **Event Emissions**: Track all actions via on-chain events

## 📁 Project Structure

```
token-vesting/
├── programs/
│   └── token-vesting/
│       ├── src/
│       │   ├── lib.rs              # Program entry point
│       │   ├── state.rs            # Account structures
│       │   ├── error.rs            # Custom errors
│       │   ├── constants.rs        # Configuration
│       │   └── instructions/
│       │       ├── mod.rs
│       │       ├── create_vesting.rs
│       │       ├── claim.rs
│       │       └── revoke.rs
│       └── Cargo.toml
├── frontend/
│   ├── src/
│   │   ├── components/             # React components
│   │   ├── hooks/                  # Custom hooks
│   │   ├── utils/                  # Helper functions
│   │   └── idl/                    # Program IDL
│   └── package.json
├── tests/
│   └── token-vesting.ts            # Integration tests
├── Anchor.toml
└── COMPLETE_TUTORIAL.md            # Detailed learning guide
```

## 🚀 Quick Start

### Prerequisites

1. **Rust** (latest stable)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Solana CLI** (v1.18+)
   ```bash
   sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
   ```

3. **Anchor** (v0.30.1)
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked
   avm install 0.30.1
   avm use 0.30.1
   ```

4. **Node.js** (v18+) and **Yarn**
   ```bash
   npm install -g yarn
   ```

### Setup

1. **Clone and install dependencies**
   ```bash
   cd token-vesting
   yarn install
   ```

2. **Configure Solana for devnet**
   ```bash
   solana config set --url devnet
   solana-keygen new  # If you don't have a keypair
   solana airdrop 5   # Get devnet SOL
   ```

3. **Build the program**
   ```bash
   anchor build
   ```

4. **Get your program ID**
   ```bash
   anchor keys list
   ```
   Update the program ID in:
   - `programs/token-vesting/src/lib.rs` (declare_id!)
   - `Anchor.toml` (programs.devnet)
   - `frontend/src/idl/token_vesting.json` (address)

5. **Rebuild with correct ID**
   ```bash
   anchor build
   ```

### Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

### Run Tests

```bash
anchor test
```

## 💻 Frontend Setup

1. **Navigate to frontend**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Update program ID**
   Edit `src/utils/program.ts`:
   ```typescript
   export const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID');
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

### Deploy Frontend

**Vercel:**
```bash
npm install -g vercel
vercel
```

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

## 📖 Usage

### Creating a Vesting Schedule

```typescript
import { createVestingSchedule } from './utils/program';

await createVestingSchedule(
  program,
  adminPublicKey,        // Your wallet
  beneficiaryPublicKey,  // Who receives tokens
  mintPublicKey,         // SPL token mint
  new BN(1000000000),    // 1 billion (with 9 decimals = 1 token)
  new BN(startTimestamp),
  new BN(86400 * 90),    // 90 days cliff
  new BN(86400 * 365)    // 365 days total vesting
);
```

### Claiming Tokens

```typescript
import { claimTokens } from './utils/program';

await claimTokens(
  program,
  beneficiaryPublicKey,  // Your wallet
  adminPublicKey,        // Who created the vesting
  mintPublicKey          // Token mint
);
```

### Revoking Vesting (Admin Only)

```typescript
import { revokeVesting } from './utils/program';

await revokeVesting(
  program,
  adminPublicKey,        // Your wallet (must be original admin)
  beneficiaryPublicKey,  // Beneficiary's wallet
  mintPublicKey          // Token mint
);
```

## 🔧 Configuration

### Vesting Constraints (in `constants.rs`)

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_VESTING_DURATION` | 86,400 | Minimum 1 day |
| `MAX_VESTING_DURATION` | 315,360,000 | Maximum 10 years |
| `MAX_CLIFF_PERCENTAGE` | 50 | Cliff ≤ 50% of duration |

### Environment Variables (Frontend)

Create `.env` file in frontend:
```env
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_PROGRAM_ID=YOUR_PROGRAM_ID
```

## 🧪 Testing Locally

1. **Start local validator**
   ```bash
   solana-test-validator
   ```

2. **In another terminal**
   ```bash
   anchor test --skip-local-validator
   ```

## 🔐 Security Considerations

- ✅ All arithmetic uses checked operations
- ✅ PDAs ensure account uniqueness
- ✅ Admin-only revocation via `has_one` constraint
- ✅ Beneficiary-only claiming via signer verification
- ✅ Cliff prevents premature claiming
- ✅ Events for full audit trail

## 📚 Learn More

See `COMPLETE_TUTORIAL.md` for:
- Theory behind token vesting
- Line-by-line code explanations
- How to build similar applications
- Advanced deployment strategies

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file

## 🆘 Support

- Open an issue for bugs
- Discussions for questions
- Check Anchor docs: https://www.anchor-lang.com/
