#![no_main]
sp1_zkvm::entrypoint!(main);

use sp1_verifier::Groth16Verifier;

/// Unpack little-endian bytes from big-endian 32-byte field elements.
/// E-PASSPORT: 3 elements [31, 31, 31] = 93 bytes
/// EU_ID_CARD: 4 elements [31, 31, 31, 1] = 94 bytes
fn unpack_revealed_data(public_inputs: &[[u8; 32]], packed_count: usize, bytes_per_elem: &[usize]) -> Vec<u8> {
    let mut result = Vec::new();
    for i in 0..packed_count {
        let count = bytes_per_elem[i];
        for j in 0..count {
            result.push(public_inputs[i][31 - j]);
        }
    }
    result
}

/// Extract surname and given name from MRZ name field.
/// Format: SURNAME<<FIRSTNAME<<<...
fn extract_name_parts(mrz_bytes: &[u8], name_start: usize, name_end: usize) -> (Vec<u8>, Vec<u8>) {
    if name_start >= mrz_bytes.len() || name_end > mrz_bytes.len() {
        return (Vec::new(), Vec::new());
    }
    let name_field = &mrz_bytes[name_start..name_end];

    // Find << separator
    let mut sep_pos = None;
    for i in 0..name_field.len().saturating_sub(1) {
        if name_field[i] == b'<' && name_field[i + 1] == b'<' {
            sep_pos = Some(i);
            break;
        }
    }

    let surname = match sep_pos {
        Some(pos) => name_field[..pos].to_vec(),
        None => {
            // No separator — trim trailing filler
            let end = name_field.iter().rposition(|&b| b != b'<' && b != 0).map(|p| p + 1).unwrap_or(0);
            name_field[..end].to_vec()
        }
    };

    let given_name = match sep_pos {
        Some(pos) => {
            let start = pos + 2;
            if start < name_field.len() {
                let raw = &name_field[start..];
                // Trim trailing < and null bytes, replace internal < with space
                let end = raw.iter().rposition(|&b| b != b'<' && b != 0).map(|p| p + 1).unwrap_or(0);
                raw[..end].iter().map(|&b| if b == b'<' { b' ' } else { b }).collect()
            } else {
                Vec::new()
            }
        }
        None => Vec::new(),
    };

    (surname, given_name)
}

/// Search for a needle (case-insensitive) in extracted text and raw PDF bytes.
fn search_in_pdf(pdf_bytes: &[u8], all_text_upper: &str, needle: &[u8]) -> bool {
    if needle.is_empty() {
        return false;
    }
    let needle_upper: Vec<u8> = needle.iter().map(|b| b.to_ascii_uppercase()).collect();

    // Search in extracted text (already uppercased)
    if let Ok(needle_str) = core::str::from_utf8(&needle_upper) {
        if all_text_upper.contains(needle_str) {
            return true;
        }
    }

    // Fallback: raw byte search (case-insensitive)
    pdf_bytes
        .windows(needle_upper.len())
        .any(|w| w.eq_ignore_ascii_case(&needle_upper))
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
        sp1_zkvm::io::commit(&false); // pdf_sig_valid
        sp1_zkvm::io::commit(&false); // surname_match
        sp1_zkvm::io::commit(&false); // name_match
        sp1_zkvm::io::commit(&false); // dob_match
        sp1_zkvm::io::commit(&(public_inputs.len() as u32));
        return;
    }

    // === Input 5: attestation ID ===
    let attestation_id: u8 = sp1_zkvm::io::read();

    // === Decode identity fields per attestation type ===
    // Layouts from Self Protocol's revealedDataIndices
    const PASSPORT_BPE: [usize; 4] = [31, 31, 31, 0];
    const ID_CARD_BPE: [usize; 4] = [31, 31, 31, 1];

    let (packed_count, bytes_per_elem, name_start, name_end, dob_start, dob_end) = match attestation_id {
        1 => (3usize, &PASSPORT_BPE[..3], 5usize, 44usize, 57usize, 63usize), // E-PASSPORT
        2 => (4usize, &ID_CARD_BPE[..4], 60usize, 90usize, 30usize, 36usize), // EU_ID_CARD
        _ => (3usize, &PASSPORT_BPE[..3], 5usize, 44usize, 57usize, 63usize), // fallback
    };

    let mrz_bytes = unpack_revealed_data(&public_inputs, packed_count, bytes_per_elem);
    let (surname_bytes, given_name_bytes) = extract_name_parts(&mrz_bytes, name_start, name_end);
    let dob_bytes: Vec<u8> = if dob_start < mrz_bytes.len() && dob_end <= mrz_bytes.len() {
        mrz_bytes[dob_start..dob_end].iter().filter(|&&b| b != 0 && b != b'<').cloned().collect()
    } else {
        Vec::new()
    };

    // === Verify PDF signature ===
    let pdf_result = signature_validator::verify_pdf_signature(&pdf_bytes);
    let pdf_sig_valid = match &pdf_result {
        Ok(result) => result.is_valid,
        Err(_) => false,
    };
    sp1_zkvm::io::commit(&pdf_sig_valid);

    // === Extract text from PDF once ===
    let all_text_upper = if pdf_sig_valid {
        extractor::extract_text(pdf_bytes.clone())
            .map(|pages| pages.join(" ").to_uppercase())
            .unwrap_or_default()
    } else {
        String::new()
    };

    // === Cross-check surname ===
    let surname_match = if pdf_sig_valid && !surname_bytes.is_empty() {
        search_in_pdf(&pdf_bytes, &all_text_upper, &surname_bytes)
    } else {
        false
    };
    sp1_zkvm::io::commit(&surname_match);

    // === Cross-check given name ===
    let name_match = if pdf_sig_valid && !given_name_bytes.is_empty() {
        search_in_pdf(&pdf_bytes, &all_text_upper, &given_name_bytes)
    } else {
        false
    };
    sp1_zkvm::io::commit(&name_match);

    // === Cross-check date of birth ===
    let dob_match = if pdf_sig_valid && !dob_bytes.is_empty() {
        search_in_pdf(&pdf_bytes, &all_text_upper, &dob_bytes)
    } else {
        false
    };
    sp1_zkvm::io::commit(&dob_match);

    sp1_zkvm::io::commit(&(public_inputs.len() as u32));
}
