use clap::Parser;
use num_bigint::BigUint;
use sp1_sdk::{include_elf, ProverClient, SP1Stdin};
use std::fs;

const ELF: &[u8] = include_elf!("zkid-program");

#[derive(Parser, Debug)]
#[command(author, version, about = "SP1 Groth16 proof verifier")]
struct Args {
    /// Directory containing gnark binary exports (proof.bin, vk.bin)
    #[arg(long)]
    gnark_dir: String,

    /// Path to captured proof JSON (for public signals)
    #[arg(long)]
    proof: String,

    /// Execute only (no proving)
    #[arg(long)]
    execute: bool,

    /// Generate an SP1 proof
    #[arg(long)]
    prove: bool,
}

#[derive(serde::Deserialize)]
struct CapturedProof {
    #[serde(rename = "publicSignals")]
    public_signals: Vec<String>,
}

fn main() {
    sp1_sdk::utils::setup_logger();
    dotenv::dotenv().ok();

    let args = Args::parse();

    // Read gnark binary files
    let proof_bin = fs::read(format!("{}/proof.bin", args.gnark_dir))
        .expect("Failed to read proof.bin");
    let vk_bin = fs::read(format!("{}/vk.bin", args.gnark_dir))
        .expect("Failed to read vk.bin");

    println!("Loaded proof.bin: {} bytes", proof_bin.len());
    println!("Loaded vk.bin: {} bytes", vk_bin.len());
    assert_eq!(proof_bin.len(), 256, "proof.bin must be exactly 256 bytes");

    // Read public signals from captured proof JSON
    let proof_json = fs::read_to_string(&args.proof)
        .expect("Failed to read proof JSON");
    let captured: CapturedProof = serde_json::from_str(&proof_json)
        .expect("Failed to parse proof JSON");

    // Convert decimal strings to 32-byte big-endian field elements
    let public_inputs: Vec<[u8; 32]> = captured.public_signals.iter().map(|s| {
        let n = s.parse::<BigUint>().expect("Invalid public signal");
        let bytes = n.to_bytes_be();
        let mut buf = [0u8; 32];
        buf[32 - bytes.len()..].copy_from_slice(&bytes);
        buf
    }).collect();

    println!("Public inputs: {} signals", public_inputs.len());

    // Setup SP1 stdin
    let mut stdin = SP1Stdin::new();
    stdin.write_vec(proof_bin);
    stdin.write_vec(vk_bin);
    stdin.write(&public_inputs);

    let client = ProverClient::from_env();

    if args.execute {
        println!("\nExecuting SP1 program...");
        let (mut output, report) = client.execute(ELF, &stdin).run().unwrap();
        println!("Execution complete: {} cycles", report.total_instruction_count());

        let groth16_verified: bool = output.read();
        let num_inputs: u32 = output.read();

        println!("Groth16 verified: {}", groth16_verified);
        println!("Public inputs count: {}", num_inputs);

        if groth16_verified {
            println!("\nSUCCESS: Groth16 proof verified inside SP1 zkVM!");
        } else {
            eprintln!("\nFAILURE: Groth16 proof verification failed");
            std::process::exit(1);
        }
    } else if args.prove {
        println!("\nSetting up SP1 proving key...");
        let (pk, vk) = client.setup(ELF);

        println!("Proving...");
        let proof = client.prove(&pk, &stdin).run().expect("failed to generate proof");
        println!("Proof generated!");

        client.verify(&proof, &vk).expect("failed to verify proof");
        println!("\nSUCCESS: SP1 proof generated and verified!");
    } else {
        eprintln!("Error: specify either --execute or --prove");
        std::process::exit(1);
    }
}
