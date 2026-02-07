#![no_main]
sp1_zkvm::entrypoint!(main);

use sp1_verifier::Groth16Verifier;

/// Unpack little-endian bytes from big-endian 32-byte field elements.
/// EU_ID_CARD packs MRZ data into 4 elements with [31, 31, 31, 1] bytes each.
/// byte[j] of element[i] = public_inputs[i][31 - j]  (big-endian storage, little-endian packing)
fn unpack_revealed_data(public_inputs: &[[u8; 32]], num_elements: usize) -> Vec<u8> {
    let bytes_per_element = [31, 31, 31, 1];
    let mut result = Vec::new();
    for i in 0..num_elements {
        let count = bytes_per_element[i];
        for j in 0..count {
            result.push(public_inputs[i][31 - j]);
        }
    }
    result
}

/// Extract surname from MRZ bytes at positions 60..89.
/// Format: SURNAME<<FIRSTNAME<<<...
fn extract_surname(mrz_bytes: &[u8]) -> Vec<u8> {
    let name_field = &mrz_bytes[60..90];
    // Find << separator
    let mut surname_end = name_field.len();
    for i in 0..name_field.len().saturating_sub(1) {
        if name_field[i] == b'<' && name_field[i + 1] == b'<' {
            surname_end = i;
            break;
        }
    }
    name_field[..surname_end].to_vec()
}

pub fn main() {
    // === Input 1-3: Groth16 proof data ===
    let proof = sp1_zkvm::io::read_vec();
    let vk = sp1_zkvm::io::read_vec();
    let public_inputs: Vec<[u8; 32]> = sp1_zkvm::io::read();

    // === Verify Groth16 proof ===
    let groth16_verified = Groth16Verifier::verify_gnark_proof(&proof, &public_inputs, &vk).is_ok();
    sp1_zkvm::io::commit(&groth16_verified);

    // === Input 4: PDF bytes (optional, length 0 means no PDF) ===
    let pdf_bytes = sp1_zkvm::io::read_vec();

    if pdf_bytes.is_empty() {
        // No PDF mode: just commit Groth16 result
        sp1_zkvm::io::commit(&false); // pdf_sig_valid
        sp1_zkvm::io::commit(&false); // surname_match
        sp1_zkvm::io::commit(&(public_inputs.len() as u32));
        return;
    }

    // === Input 5: attestation ID ===
    let attestation_id: u8 = sp1_zkvm::io::read();

    // === Decode surname from public signals ===
    let mrz_bytes = unpack_revealed_data(&public_inputs, 4);
    let surname_bytes = extract_surname(&mrz_bytes);

    // === Verify PDF signature ===
    let pdf_result = signature_validator::verify_pdf_signature(&pdf_bytes);
    let pdf_sig_valid = match &pdf_result {
        Ok(result) => result.is_valid,
        Err(_) => false,
    };
    sp1_zkvm::io::commit(&pdf_sig_valid);

    // === Extract text from PDF and cross-check surname ===
    let surname_match = if pdf_sig_valid && !surname_bytes.is_empty() {
        let surname_upper: Vec<u8> = surname_bytes.iter().map(|b| b.to_ascii_uppercase()).collect();

        // Try text extraction first
        let mut found = false;
        if let Ok(pages) = extractor::extract_text(pdf_bytes.clone()) {
            let all_text: String = pages.join(" ").to_uppercase();
            if let Ok(surname_str) = core::str::from_utf8(&surname_upper) {
                found = all_text.contains(surname_str);
            }
        }

        // Fallback: search raw PDF bytes for surname
        if !found {
            if let Some(_) = pdf_bytes
                .windows(surname_upper.len())
                .position(|w| w.eq_ignore_ascii_case(&surname_upper))
            {
                found = true;
            }
        }

        found
    } else {
        false
    };
    sp1_zkvm::io::commit(&surname_match);
    sp1_zkvm::io::commit(&(public_inputs.len() as u32));
}
