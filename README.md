# Constant Product AMM (Automated Market Maker)

> **Turbin3 Q4 2025 Assignment** - A decentralized exchange implementing the constant product formula (x * y = k) built on Solana using Anchor.

## Overview

This project implements a fully functional **Automated Market Maker (AMM)** using the constant product formula, similar to Uniswap V2. The AMM allows users to provide liquidity, swap tokens, and withdraw their liquidity while earning fees from trades.

### What is a Constant Product AMM?

The constant product formula maintains the invariant: **x × y = k**

- **x** = amount of token X in the pool
- **y** = amount of token Y in the pool
- **k** = constant product

When a user swaps tokens, the formula ensures that the product remains constant (minus fees), automatically adjusting prices based on supply and demand.

## Features

### Core Functionality
- **Pool Initialization** - Create liquidity pools for any SPL token pair
- **Add Liquidity** - Deposit tokens and receive LP tokens representing pool ownership
- **Remove Liquidity** - Burn LP tokens to withdraw proportional amounts of both tokens
- **Token Swaps** - Exchange one token for another with automatic price discovery
- **Fee Collection** - Configurable swap fees (in basis points)

### Security Features
- **Slippage Protection** - Min/max parameters prevent unfavorable trades
- **Pool Locking** - Authority can pause pool operations
- **Init If Needed** - Automatic ATA creation for recipient accounts
- **Post-Swap Validation** - Ensures non-zero transfers prevent edge cases
- **Authority Control** - Only designated authority can lock/unlock pools

## Architecture

### Program Structure
```
programs/
└── anchor-amm-q4-25/
    └── src/
        ├── lib.rs                  # Program entry point
        ├── state/
        │   └── config.rs          # Pool configuration
        ├── instructions/
        │   ├── initialize.rs      # Pool initialization
        │   ├── deposit.rs         # Add liquidity
        │   ├── withdraw.rs        # Remove liquidity
        │   ├── swap.rs            # Token swaps
        │   └── lock.rs            # Pool locking
        └── errors.rs              # Custom error definitions
```

### State Accounts

**Config Account**
- Mint X and Mint Y (token pair)
- Fee (basis points, max 10000 = 100%)
- Authority (admin)
- Locked status
- Seed and bump values

**LP Token Mint**
- Represents ownership share of the pool
- Minted when adding liquidity
- Burned when removing liquidity

## Getting Started

### Prerequisites
- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.32.1
- Node.js 18+
- Yarn

### Installation

```bash
cd anchor-amm-starter-q4-25

# Install dependencies
yarn install

# Build the program
anchor build

# Run tests
anchor test
```

## Usage Examples

### Initialize a Pool

```typescript
await program.methods.initialize(
  seed,           // u64: Unique identifier
  fee,            // u16: Fee in basis points (100 = 1%)
  authority,      // Pubkey: Pool admin
).accounts({...}).rpc();
```

### Add Liquidity

```typescript
await program.methods.deposit(
  lpAmount,       // u64: LP tokens to mint
  maxX,           // u64: Max token X to deposit (slippage protection)
  maxY,           // u64: Max token Y to deposit (slippage protection)
).accounts({...}).rpc();
```

### Swap Tokens

```typescript
await program.methods.swap(
  isX,            // bool: true = swap X for Y, false = swap Y for X
  amountIn,       // u64: Amount to swap
  minAmountOut,   // u64: Minimum to receive (slippage protection)
).accounts({...}).rpc();
```

### Withdraw Liquidity

```typescript
await program.methods.withdraw(
  lpAmount,       // u64: LP tokens to burn
  minX,           // u64: Minimum token X to receive
  minY,           // u64: Minimum token Y to receive
).accounts({...}).rpc();
```

## Testing

The test suite includes comprehensive coverage:

### Functional Tests
- Pool initialization
- Initial liquidity deposit
- Additional liquidity deposit
- Token swaps (X→Y)
- Partial liquidity withdrawal
- Full liquidity withdrawal

### Security Tests
- Slippage protection on deposits
- Slippage protection on withdrawals
- Pool locking/unlocking
- Non-authority rejection
- Fee validation (>100% rejected)

Run all tests:
```bash
anchor test
```

## Fee Mechanism

Swap fees are charged on the **output token** and automatically retained in the pool:
- Fee is specified in basis points (10000 = 100%)
- Example: 1% fee = 100 basis points
- Fees benefit liquidity providers by increasing pool value

## Constant Product Curve

This implementation uses the [constant-product-curve](https://github.com/deanmlittle/constant-product-curve) library which handles:
- Precise mathematical calculations
- Overflow/underflow protection
- Slippage validation
- Fee application

## 📚 Resources

- [Constant Product Formula Explained](https://docs.uniswap.org/contracts/v2/concepts/protocol-overview/how-uniswap-works)
- [Anchor Framework Docs](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Turbin3 Program](https://www.turbin3.org/)
