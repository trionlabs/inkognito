#![no_main]
sp1_zkvm::entrypoint!(main);

use sp1_verifier::Groth16Verifier;

pub fn main() {
    // Read gnark binary inputs
    let proof = sp1_zkvm::io::read_vec();
    let vk = sp1_zkvm::io::read_vec();
    let public_inputs: Vec<[u8; 32]> = sp1_zkvm::io::read();

    // Verify Groth16 proof
    let groth16_verified =
        Groth16Verifier::verify_gnark_proof(&proof, &public_inputs, &vk).is_ok();
    sp1_zkvm::io::commit(&groth16_verified);
    sp1_zkvm::io::commit(&(public_inputs.len() as u32));
}
