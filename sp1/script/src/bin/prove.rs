use clap::Parser;
use sp1_sdk::{include_elf, ProverClient, SP1Stdin};
use std::fs;

const ELF: &[u8] = include_elf!("zkid-program");

#[derive(Parser, Debug)]
#[command(author, version, about = "SP1 zkID + PDF cross-check verifier")]
struct Args {
    /// Directory containing gnark exports (proof.bin, vk.bin, public_inputs.bin, identity.json)
    #[arg(long)]
    gnark_dir: String,

    /// Path to signed PDF for cross-check (optional)
    #[arg(long)]
    pdf: Option<String>,

    /// Execute only (no proving)
    #[arg(long)]
    execute: bool,

    /// Generate an SP1 proof
    #[arg(long)]
    prove: bool,
}

#[derive(serde::Deserialize)]
struct Identity {
    attestation_id: u8,
}

fn main() {
    sp1_sdk::utils::setup_logger();
    dotenv::dotenv().ok();

    let args = Args::parse();

    // Read all inputs from gnark-dir
    let proof_bin = fs::read(format!("{}/proof.bin", args.gnark_dir))
        .expect("Failed to read proof.bin");
    let vk_bin = fs::read(format!("{}/vk.bin", args.gnark_dir))
        .expect("Failed to read vk.bin");
    let pi_bin = fs::read(format!("{}/public_inputs.bin", args.gnark_dir))
        .expect("Failed to read public_inputs.bin");

    println!("Loaded proof.bin: {} bytes", proof_bin.len());
    println!("Loaded vk.bin: {} bytes", vk_bin.len());
    assert_eq!(proof_bin.len(), 256, "proof.bin must be exactly 256 bytes");

    // Parse public inputs: concatenated 32-byte big-endian field elements
    assert!(pi_bin.len() % 32 == 0, "public_inputs.bin must be a multiple of 32 bytes");
    let public_inputs: Vec<[u8; 32]> = pi_bin
        .chunks_exact(32)
        .map(|chunk| {
            let mut buf = [0u8; 32];
            buf.copy_from_slice(chunk);
            buf
        })
        .collect();
    println!("Public inputs: {} signals", public_inputs.len());

    // Read attestation ID from identity.json
    let identity_json = fs::read_to_string(format!("{}/identity.json", args.gnark_dir))
        .expect("Failed to read identity.json");
    let identity: Identity = serde_json::from_str(&identity_json)
        .expect("Failed to parse identity.json");
    println!("Attestation ID: {}", identity.attestation_id);

    // Read PDF if provided
    let pdf_bytes = match &args.pdf {
        Some(path) => {
            let bytes = fs::read(path).expect("Failed to read PDF file");
            println!("Loaded PDF: {} bytes", bytes.len());
            bytes
        }
        None => Vec::new(),
    };
    let has_pdf = !pdf_bytes.is_empty();

    // Setup SP1 stdin — order must match guest program
    let mut stdin = SP1Stdin::new();
    stdin.write_vec(proof_bin);
    stdin.write_vec(vk_bin);
    stdin.write(&public_inputs);
    stdin.write_vec(pdf_bytes);
    if has_pdf {
        stdin.write(&identity.attestation_id);
    }

    let client = ProverClient::from_env();

    if args.execute {
        println!("\nExecuting SP1 program...");
        let (mut output, report) = client.execute(ELF, &stdin).run().unwrap();
        println!("Execution complete: {} cycles", report.total_instruction_count());

        let groth16_verified: bool = output.read();
        println!("Groth16 verified: {}", groth16_verified);

        let pdf_sig_valid: bool = output.read();
        let surname_match: bool = output.read();
        let num_inputs: u32 = output.read();

        if has_pdf {
            println!("PDF signature valid: {}", pdf_sig_valid);
            println!("Surname match: {}", surname_match);
        }
        println!("Public inputs count: {}", num_inputs);

        if groth16_verified && (!has_pdf || (pdf_sig_valid && surname_match)) {
            if has_pdf {
                println!("\nSUCCESS: Identity proof + PDF signature verified, surname cross-check passed!");
            } else {
                println!("\nSUCCESS: Groth16 proof verified inside SP1 zkVM!");
            }
        } else {
            eprintln!("\nFAILURE: Verification failed inside SP1 zkVM");
            if !groth16_verified {
                eprintln!("  - Groth16 proof verification failed");
            }
            if has_pdf && !pdf_sig_valid {
                eprintln!("  - PDF signature verification failed");
            }
            if has_pdf && !surname_match {
                eprintln!("  - Surname cross-check failed");
            }
            std::process::exit(1);
        }
    } else if args.prove {
        println!("\nSetting up SP1 proving key...");
        let (pk, vk) = client.setup(ELF);

        println!("Proving, this will take a long time on CPU...");
        let proof = client.prove(&pk, &stdin).run().expect("failed to generate proof");
        println!("Proof generated!");

        client.verify(&proof, &vk).expect("failed to verify proof");
        println!("\nSUCCESS: SP1 proof generated and verified!");
    } else {
        eprintln!("Error: specify either --execute or --prove");
        std::process::exit(1);
    }
}
