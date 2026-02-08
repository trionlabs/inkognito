import { NextResponse } from "next/server";
import http2 from "node:http2";

// Native gRPC over HTTP/2 to Succinct prover network
// RPC: network.ProverNetwork/GetProofRequestStatus
// Request proto: message { bytes request_id = 1; }
// Response proto: message { FulfillmentStatus fulfillment_status = 1; ... }
// FulfillmentStatus: 0=unspecified, 1=requested, 2=assigned, 3=fulfilled, 4=unfulfillable

// Try production (reserved) first — that's where the SDK submits by default
const RPC_ENDPOINTS = [
  "https://rpc.production.succinct.xyz",
  "https://rpc.mainnet.succinct.xyz",
];
const METHOD = "/network.ProverNetwork/GetProofRequestStatus";

const STATUS_MAP: Record<number, string> = {
  0: "pending",
  1: "pending",    // Requested
  2: "assigned",   // Assigned to prover
  3: "fulfilled",  // Done
  4: "failed",     // Unfulfillable
};

function hexToBytes(hex: string): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(clean, "hex");
}

function encodeProtobufBytes(fieldNumber: number, data: Buffer): Buffer {
  const tag = (fieldNumber << 3) | 2;
  const lenBytes: number[] = [];
  let len = data.length;
  while (len > 0x7f) {
    lenBytes.push((len & 0x7f) | 0x80);
    len >>= 7;
  }
  lenBytes.push(len);

  const result = Buffer.alloc(1 + lenBytes.length + data.length);
  result[0] = tag;
  Buffer.from(lenBytes).copy(result, 1);
  data.copy(result, 1 + lenBytes.length);
  return result;
}

function grpcFrame(message: Buffer): Buffer {
  const frame = Buffer.alloc(5 + message.length);
  frame[0] = 0; // not compressed
  frame.writeUInt32BE(message.length, 1);
  message.copy(frame, 5);
  return frame;
}

function decodeVarint(buf: Buffer, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos];
    result |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [result, pos];
}

function queryGrpc(rpcUrl: string, requestIdBytes: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    const client = http2.connect(rpcUrl);

    client.on("error", (err) => {
      client.close();
      reject(err);
    });

    const protoMsg = encodeProtobufBytes(1, requestIdBytes);
    const frame = grpcFrame(protoMsg);

    const req = client.request({
      ":method": "POST",
      ":path": METHOD,
      "content-type": "application/grpc",
      "te": "trailers",
    });

    req.write(frame);
    req.end();

    const timeout = setTimeout(() => {
      req.close();
      client.close();
      reject(new Error("Timeout"));
    }, 10_000);

    const chunks: Buffer[] = [];
    let grpcStatus = -1;

    // gRPC status can come in response headers (Trailers-Only) or trailers
    req.on("response", (headers) => {
      const status = headers["grpc-status"];
      if (status !== undefined) {
        grpcStatus = parseInt(String(status), 10);
      }
    });

    req.on("trailers", (headers) => {
      const status = headers["grpc-status"];
      if (status !== undefined) {
        grpcStatus = parseInt(String(status), 10);
      }
    });

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      clearTimeout(timeout);
      client.close();

      if (grpcStatus !== 0) {
        reject(new Error(`gRPC error status ${grpcStatus}`));
        return;
      }

      const data = Buffer.concat(chunks);
      if (data.length < 6) {
        reject(new Error("Empty gRPC response"));
        return;
      }

      // Skip 5-byte gRPC frame header, parse protobuf
      const msgStart = 5;
      const [tag, pos] = decodeVarint(data, msgStart);
      if ((tag & 0x07) !== 0) {
        reject(new Error("Unexpected protobuf wire type"));
        return;
      }
      const [value] = decodeVarint(data, pos);
      resolve(value);
    });

    req.on("error", (err) => {
      clearTimeout(timeout);
      client.close();
      reject(err);
    });
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestId = url.searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 });
  }

  const idBytes = hexToBytes(requestId);

  // Try each RPC endpoint (production first, then mainnet fallback)
  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const fulfillmentStatus = await queryGrpc(rpcUrl, idBytes);
      const status = STATUS_MAP[fulfillmentStatus] || "pending";
      return NextResponse.json({ status });
    } catch {
      continue; // try next endpoint
    }
  }

  // All endpoints failed
  return NextResponse.json({ status: "pending" });
}
