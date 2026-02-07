# SP1 zkPDF + Self ID

Compose zkPDF document proofs with Self Protocol identity proofs (Passport, EU ID, Aadhaar) inside SP1 zkVM. Verifies a Groth16 identity proof, a PDF digital signature, and cross-checks the surname between the two — all in a single zero-knowledge proof.

```
                    ┌─────────────┐
                    │  Self App   │
                    │  (scan ID)  │
                    └──────┬──────┘
                           │ Groth16 proof
                           ▼
┌──────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Frontend │──────▶│  self2gnark  │──────▶│   SP1 zkVM   │──────▶│  Composed    │
│ (Next.js)│ POST  │  (Go CLI)    │ bin   │  (Rust guest)│       │  ZK Proof    │
└──────────┘       └──────────────┘       └──────┬───────┘       └──────────────┘
                                                 │
                                           ┌─────┴─────┐
                                           │ Signed PDF │
                                           └───────────┘
```

**What SP1 verifies:**
1. Groth16 BN254 proof from Self Protocol (identity)
2. PDF digital signature (document authenticity)
3. Name, surname, ID number etc. cross-check between identity proof and PDF signer


## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and pnpm
- [Go](https://go.dev/) 1.21+
- [SP1](https://docs.succinct.xyz/) v5.2.4: `sp1up --version v5.2.4`
- [ngrok](https://ngrok.com/) (Self Protocol requires a public endpoint)
- [Self Protocol](https://self.xyz/) app on your phone

## Step 1: Capture Identity Proof (Frontend)

```bash
cd app
pnpm install

# Start ngrok tunnel (separate terminal)
ngrok http 3000

# Set your ngrok URL in .env
cp .env.example .env

pnpm dev
```

1. Open `http://localhost:3000`
2. Scan the QR code with the Self Protocol app
3. Proof is saved to `proofs/` as JSON

## Step 2: Convert Proof (Go CLI)

```bash
cd self2gnark

# Convert + verify + decode identity + export gnark binaries
go run main.go --proof ../proofs/<proof_id>.json --export-gnark ../gnark-out/ --decode
```

This:
1. Converts Self Protocol format (`a/b/c`) to snarkjs (`pi_a/pi_b/pi_c`)
2. Auto-selects verification key by attestation type
3. Converts snarkjs to gnark via `circom2gnark` and verifies
4. Decodes MRZ identity fields (surname, given name, DOB, nationality)
5. Exports to `gnark-out/`: `proof.bin`, `vk.bin`, `public_inputs.bin`, `identity.json`

## Step 3: Verify in SP1

```bash
cd sp1

# Self Groth16 verification only
cargo run --release --bin prove -- --execute --gnark-dir ../gnark-out

# Groth16 + PDF signature + name, surname and ID number cross-check
cargo run --release --bin prove -- --execute --gnark-dir ../gnark-out --pdf <path-to-signed.pdf>
```

### Flags

| Flag | Description |
|------|-------------|
| `--gnark-dir` | Directory with gnark exports (proof.bin, vk.bin, public_inputs.bin, identity.json) |
| `--pdf` | Optional signed PDF for signature verification + surname cross-check |
| `--execute` | Run in SP1 executor (fast, no proof generated) |
| `--prove` | Generate a full SP1 proof (slow on CPU) |

## Attestation Types

| ID | Type | Verification Key |
|----|------|-----------------|
| 1 | E-PASSPORT | `self-vkeys/vc_and_disclose.json` |
| 2 | EU_ID_CARD | `self-vkeys/vc_and_disclose_id.json` |
| 3 | AADHAAR | `self-vkeys/vc_and_disclose_aadhaar.json` |

## SP1 Verifier Patch

SP1 v5.2.4's `sp1-verifier` panics on zero-valued public inputs (`AffineG1 * Fr(0)` calls `unwrap()` on `None`). Our proof has zeros at indices 3-7, 13, 15. The patch applies a one-line fix:

```rust
// sp1-verifier-patch/src/groth16/verify.rs:45
if *i != Fr::zero() { acc + (*b * *i) } else { acc }
```
