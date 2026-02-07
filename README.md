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
