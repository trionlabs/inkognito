package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/big"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/vocdoni/circom2gnark/parser"
)

// CapturedProof matches the JSON structure saved by the API route
type CapturedProof struct {
	AttestationID json.RawMessage `json:"attestationId"`
	Proof         json.RawMessage `json:"proof"`
	PublicSignals json.RawMessage `json:"publicSignals"`
	ProofID       string          `json:"proofId"`
	CapturedAt    string          `json:"capturedAt"`
}

// SelfProtocolProof is the proof format Self Protocol actually sends
// Different from snarkjs: uses `a`, `b`, `c` instead of `pi_a`, `pi_b`, `pi_c` and omits the projective `Z` coordinate
type SelfProtocolProof struct {
	A        []string   `json:"a"`
	B        [][]string `json:"b"`
	C        []string   `json:"c"`
	Protocol string     `json:"protocol"`
	Curve    string     `json:"curve"`
	// snarkjs fields (if already in snarkjs format)
	PiA []string   `json:"pi_a"`
	PiB [][]string `json:"pi_b"`
	PiC []string   `json:"pi_c"`
}

// `toCircomProof“ converts a Self Protocol proof to the snarkjs/circom format that circom2gnark expects.
func (s *SelfProtocolProof) toCircomProof() *parser.CircomProof {
	piA := s.PiA
	piB := s.PiB
	piC := s.PiC

	if len(piA) == 0 && len(s.A) > 0 {
		// Self Protocol format: `a`, `b`, `c` without projective `Z`
		// Add the projective Z coordinate (`1` for G1, `["1","0"]` for G2)
		piA = append(s.A, "1")
		piC = append(s.C, "1")
		piB = make([][]string, len(s.B)+1)
		copy(piB, s.B)
		piB[len(s.B)] = []string{"1", "0"}
	}

	return &parser.CircomProof{
		PiA:      piA,
		PiB:      piB,
		PiC:      piC,
		Protocol: s.Protocol,
	}
}

// vkey files per attestation ID
// 1 = E-PASSPORT, 2 = EU_ID_CARD, 3 = AADHAAR
var vkeyFiles = map[int]string{
	1: "vc_and_disclose.json",
	2: "vc_and_disclose_id.json",
	3: "vc_and_disclose_aadhaar.json",
}

var attestationNames = map[int]string{
	1: "E-PASSPORT",
	2: "EU_ID_CARD",
	3: "AADHAAR",
}

// `decodeIdCardSignals` unpacks `revealedData_packed[0..3]` from public signals to extract identity fields from EU_ID_CARD/E-PASSPORT MRZ data.
// Each public signal is a field element; bytes are packed little-endian:
// `byte[j] = (element >> (j*8)) & 0xFF`
// Element sizes: [31, 31, 31, 1] -> 94 bytes total
func decodeIdCardSignals(signals []string) map[string]string {
	bytesPerElement := []int{31, 31, 31, 1}
	var allBytes []byte

	for i := 0; i < 4 && i < len(signals); i++ {
		n := new(big.Int)
		n.SetString(signals[i], 10)

		count := bytesPerElement[i]
		for j := 0; j < count; j++ {
			// little-endian: byte j = (n >> (j*8)) & 0xFF
			shifted := new(big.Int).Rsh(n, uint(j*8))
			b := byte(shifted.Int64() & 0xFF)
			allBytes = append(allBytes, b)
		}
	}

	fmt.Printf("Decoded %d bytes from public signals\n", len(allBytes))

	result := make(map[string]string)

	// Extract fields from MRZ byte positions
	if len(allBytes) >= 92 {
		result["issuing_state"] = strings.TrimRight(string(allBytes[2:5]), "\x00 ")
		result["dob"] = strings.TrimRight(string(allBytes[30:36]), "\x00 ")
		result["nationality"] = strings.TrimRight(string(allBytes[45:48]), "\x00 ")

		// Name field: bytes 60..89
		nameRaw := strings.TrimRight(string(allBytes[60:90]), "\x00 <")
		parts := strings.SplitN(nameRaw, "<<", 2)
		result["surname"] = strings.TrimRight(parts[0], "<")
		if len(parts) > 1 {
			result["given_name"] = strings.ReplaceAll(strings.TrimRight(parts[1], "<"), "<", " ")
		}

		result["older_than"] = strings.TrimRight(string(allBytes[90:92]), "\x00 ")
	}

	return result
}

func main() {
	proofPath := flag.String("proof", "", "Path to captured proof JSON file")
	vkPath := flag.String("vk", "", "Path to verification key JSON file (overrides auto-detection)")
	vkDir := flag.String("vk-dir", "", "Directory containing vkey files (default: ../self-vkeys/)")
	proofOnly := flag.String("proof-only", "", "Path to standalone proof JSON file (snarkjs format)")
	pubSignalsPath := flag.String("public-signals", "", "Path to standalone public signals JSON file")
	exportGnark := flag.String("export-gnark", "", "Directory to export gnark binary files (proof.bin, vk.bin, public_inputs.bin)")
	decode := flag.Bool("decode", false, "Decode identity fields from public signals (EU_ID_CARD/E-PASSPORT)")
	flag.Parse()

	if *proofPath == "" && *proofOnly == "" {
		fmt.Println("Usage:")
		fmt.Println("  # From captured proof (auto-selects vkey by attestationId):")
		fmt.Println("  go run main.go --proof ../proofs/<id>.json")
		fmt.Println()
		fmt.Println("  # From captured proof with explicit vkey:")
		fmt.Println("  go run main.go --proof ../proofs/<id>.json --vk ../self-vkeys/vc_and_disclose.json")
		fmt.Println()
		fmt.Println("  # From standalone snarkjs files:")
		fmt.Println("  go run main.go --proof-only proof.json --vk vkey.json --public-signals public_signals.json")
		os.Exit(1)
	}

	var proofJSON, pubSignalsJSON, vkJSON []byte
	var err error
	attID := 0

	if *proofPath != "" {
		// Parse captured proof
		capturedData, err := os.ReadFile(*proofPath)
		if err != nil {
			log.Fatalf("Failed to read captured proof: %v", err)
		}

		var captured CapturedProof
		if err := json.Unmarshal(capturedData, &captured); err != nil {
			log.Fatalf("Failed to parse captured proof JSON: %v", err)
		}

		// Parse attestation ID (can be int or string)
		attIDStr := strings.Trim(string(captured.AttestationID), "\"")
		attID, _ = strconv.Atoi(attIDStr)

		fmt.Printf("Proof ID: %s\n", captured.ProofID)
		fmt.Printf("Captured at: %s\n", captured.CapturedAt)
		fmt.Printf("Attestation ID: %d (%s)\n", attID, attestationNames[attID])

		proofJSON = captured.Proof
		pubSignalsJSON = captured.PublicSignals

		// Auto-select vkey if not explicitly provided
		if *vkPath == "" {
			vkFile, ok := vkeyFiles[attID]
			if !ok {
				log.Fatalf("Unknown attestation ID %d — provide --vk explicitly", attID)
			}
			dir := *vkDir
			if dir == "" {
				dir = filepath.Join(filepath.Dir(*proofPath), "..", "self-vkeys")
			}
			autoVkPath := filepath.Join(dir, vkFile)
			fmt.Printf("Auto-selected vkey: %s\n", autoVkPath)
			vkJSON, err = os.ReadFile(autoVkPath)
			if err != nil {
				log.Fatalf("Failed to read auto-selected vkey: %v\n  (use --vk to override)", err)
			}
		}
	} else {
		// Parse standalone files
		proofJSON, err = os.ReadFile(*proofOnly)
		if err != nil {
			log.Fatalf("Failed to read proof file: %v", err)
		}
		if *pubSignalsPath == "" {
			log.Fatal("--public-signals is required when using --proof-only")
		}
		pubSignalsJSON, err = os.ReadFile(*pubSignalsPath)
		if err != nil {
			log.Fatalf("Failed to read public signals file: %v", err)
		}
		if *vkPath == "" {
			log.Fatal("--vk is required when using --proof-only")
		}
	}

	// Load explicit vkey if provided (overrides auto-selection)
	if *vkPath != "" {
		vkJSON, err = os.ReadFile(*vkPath)
		if err != nil {
			log.Fatalf("Failed to read verification key: %v", err)
		}
	}

	// Parse the proof, handle both Self Protocol and snarkjs formats
	fmt.Println("\n--- Parsing proof data ---")

	var selfProof SelfProtocolProof
	if err := json.Unmarshal(proofJSON, &selfProof); err != nil {
		log.Fatalf("Failed to unmarshal proof: %v", err)
	}

	if len(selfProof.A) > 0 && len(selfProof.PiA) == 0 {
		fmt.Println("Detected Self Protocol format (a/b/c) — converting to snarkjs (pi_a/pi_b/pi_c)")
	} else if len(selfProof.PiA) > 0 {
		fmt.Println("Detected snarkjs format (pi_a/pi_b/pi_c)")
	} else {
		log.Fatal("Unknown proof format: neither 'a' nor 'pi_a' found")
	}

	circomProof := selfProof.toCircomProof()
	fmt.Printf("Proof protocol: %s\n", circomProof.Protocol)

	// Parse verification key
	circomVk, err := parser.UnmarshalCircomVerificationKeyJSON(vkJSON)
	if err != nil {
		log.Fatalf("Failed to unmarshal verification key: %v", err)
	}
	fmt.Printf("VK: curve=%s, nPublic=%d, IC=%d\n",
		circomVk.Curve, circomVk.NPublic, len(circomVk.IC))

	// Parse public signals
	publicSignals, err := parser.UnmarshalCircomPublicSignalsJSON(pubSignalsJSON)
	if err != nil {
		log.Fatalf("Failed to unmarshal public signals: %v", err)
	}
	fmt.Printf("Public signals: %d\n", len(publicSignals))

	if len(publicSignals) != circomVk.NPublic {
		log.Fatalf("MISMATCH: proof has %d public signals but vkey expects %d — wrong vkey?",
			len(publicSignals), circomVk.NPublic)
	}

	// Convert circom 2 gnark
	fmt.Println("\n--- Converting to gnark format ---")
	startTime := time.Now()

	gnarkProof, err := parser.ConvertCircomToGnark(circomVk, circomProof, publicSignals)
	if err != nil {
		log.Fatalf("Failed to convert circom to gnark: %v", err)
	}
	fmt.Printf("Conversion: %v\n", time.Since(startTime))

	// Verify using gnark
	fmt.Println("\n--- Verifying with gnark (BN254 pairing) ---")
	startTime = time.Now()

	verified, err := parser.VerifyProof(gnarkProof)
	if err != nil {
		log.Fatalf("Verification error: %v", err)
	}

	elapsed := time.Since(startTime)
	if verified {
		fmt.Printf("PROOF VERIFIED in %v\n", elapsed)
	} else {
		fmt.Printf("PROOF INVALID (took %v)\n", elapsed)
		os.Exit(1)
	}

	// Decode identity fields if requested
	if *decode {
		var signals []string
		if err := json.Unmarshal(pubSignalsJSON, &signals); err != nil {
			log.Fatalf("Failed to parse public signals for decoding: %v", err)
		}
		fmt.Println("\n--- Decoding identity fields ---")
		identity := decodeIdCardSignals(signals)
		for k, v := range identity {
			fmt.Printf("  %s: %s\n", k, v)
		}
	}

	// Export gnark binary files if requested
	if *exportGnark != "" {
		fmt.Printf("\n--- Exporting gnark binary files to %s ---\n", *exportGnark)
		if err := os.MkdirAll(*exportGnark, 0755); err != nil {
			log.Fatalf("Failed to create export dir: %v", err)
		}

		// Export proof: first 256 bytes of WriteRawTo (Ar 64B + Bs 128B + Krs 64B)
		var proofBuf bytes.Buffer
		if _, err := gnarkProof.Proof.WriteRawTo(&proofBuf); err != nil {
			log.Fatalf("Failed to serialize proof: %v", err)
		}
		proofBytes := proofBuf.Bytes()[:256] // Ar + Bs + Krs only, no commitment data
		if err := os.WriteFile(filepath.Join(*exportGnark, "proof.bin"), proofBytes, 0644); err != nil {
			log.Fatalf("Failed to write proof.bin: %v", err)
		}
		fmt.Printf("Exported proof.bin: %d bytes\n", len(proofBytes))

		// Export VK: compressed format via WriteTo (SP1 reads this format)
		var vkBuf bytes.Buffer
		if _, err := gnarkProof.VerifyingKey.WriteTo(&vkBuf); err != nil {
			log.Fatalf("Failed to serialize VK: %v", err)
		}
		vkBytes := vkBuf.Bytes()
		if err := os.WriteFile(filepath.Join(*exportGnark, "vk.bin"), vkBytes, 0644); err != nil {
			log.Fatalf("Failed to write vk.bin: %v", err)
		}
		fmt.Printf("Exported vk.bin: %d bytes\n", len(vkBytes))

		// Export public inputs: each as 32-byte big-endian, concatenated
		var piBuf bytes.Buffer
		for _, pi := range gnarkProof.PublicInputs {
			var b big.Int
			pi.BigInt(&b)
			padded := make([]byte, 32)
			bBytes := b.Bytes()
			copy(padded[32-len(bBytes):], bBytes)
			piBuf.Write(padded)
		}
		piBytes := piBuf.Bytes()
		if err := os.WriteFile(filepath.Join(*exportGnark, "public_inputs.bin"), piBytes, 0644); err != nil {
			log.Fatalf("Failed to write public_inputs.bin: %v", err)
		}
		fmt.Printf("Exported public_inputs.bin: %d bytes (%d signals x 32B)\n",
			len(piBytes), len(gnarkProof.PublicInputs))

		// Export identity.json with attestation_id + decoded fields (if available)
		identity := map[string]interface{}{
			"attestation_id": attID,
		}
		if *decode {
			var signals []string
			if err := json.Unmarshal(pubSignalsJSON, &signals); err == nil {
				decoded := decodeIdCardSignals(signals)
				for k, v := range decoded {
					identity[k] = v
				}
			}
		}
		idJSON, _ := json.MarshalIndent(identity, "", "  ")
		idPath := filepath.Join(*exportGnark, "identity.json")
		if err := os.WriteFile(idPath, idJSON, 0644); err != nil {
			log.Fatalf("Failed to write identity.json: %v", err)
		}
		fmt.Printf("Exported identity.json to %s\n", idPath)
	}

	fmt.Println("\nDone.")
}
