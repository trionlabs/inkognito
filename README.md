# SP1 zkPDF + Self ID

Compose zkPDF document proofs with Self Protocol identity proofs (Passport, EU ID, Aadhaar) inside SP1 zkVM.

## App (Next.js Frontend)

Captures Self Protocol Groth16 identity proofs via QR code scan.

### Setup

```bash
cd app
pnpm install

# Start ngrok tunnel (separate terminal)
ngrok http 3000

# Copy the https URL and set it in .env
cp .env.example .env

pnpm dev
```

### How it works

1. Open `http://localhost:3000` in your browser
2. Scan the QR code with the [Self Protocol](https://self.xyz/) app
3. The app captures the Groth16 proof and saves it to `proofs/`

## Self-to-gnark Converter (Go)

Converts Self Protocol proofs from circom/snarkjs format to gnark format, verifies them, and decodes identity fields.

### Setup

```bash
cd self2gnark
go build -o self2gnark .
```

### Usage

```bash
# Convert + verify + decode identity
go run main.go --proof ../proofs/<proof_id>.json --decode

# Export gnark binary files for SP1
go run main.go --proof ../proofs/<proof_id>.json --export-gnark ../gnark-out/

# Both
go run main.go --proof ../proofs/<proof_id>.json --export-gnark ../gnark-out/ --decode
```

### What it does

1. Converts Self Protocol proof format (`a/b/c`) to snarkjs (`pi_a/pi_b/pi_c`) with projective Z coordinates
2. Auto-selects verification key based on attestation type (Passport, EU ID, Aadhaar)
3. Converts snarkjs → gnark format via `circom2gnark`
4. Verifies the proof using gnark BN254 pairing
5. `--decode`: unpacks MRZ identity fields (surname, given name, DOB, nationality, older_than)
6. `--export-gnark`: exports `proof.bin`, `vk.bin`, `public_inputs.bin` for SP1 consumption
