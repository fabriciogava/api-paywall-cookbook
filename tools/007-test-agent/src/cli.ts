/**
 * CLI Argument Parsing and Validation
 *
 * This module handles command-line argument parsing for the 007 Test Agent.
 * Extracted for testability and maintainability.
 */

// Valid network options for the --network flag
const VALID_NETWORKS = ["solana-mainnet", "solana", "base-mainnet", "base", "skale-mainnet", "skale"] as const;
export type NetworkOption = typeof VALID_NETWORKS[number];

export interface ParsedArgs {
    targetUrl: string;
    requestBody?: string;
    network?: NetworkOption;
    timeout?: number;
    filePath?: string;
}

export interface ParseOptions {
    defaultUrl?: string;
    args?: string[];
}

/**
 * Parse command-line arguments
 * @param options - Parse options including default URL and args array
 * @returns Parsed arguments object
 */
export function parseArgs(options: ParseOptions = {}): ParsedArgs {
    const DEFAULT_TARGET_URL = options.defaultUrl || "http://localhost:3000/answer";
    const args = options.args || process.argv.slice(2);

    let targetUrl = DEFAULT_TARGET_URL;
    let requestBody: string | undefined;
    let network: NetworkOption | undefined;
    let timeout: number | undefined;
    let filePath: string | undefined;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === "--file" || arg === "-f") {
            const value = args[++i];
            if (!value || value.startsWith("-")) {
                throw new Error("--file flag requires a file path");
            }
            filePath = value;
        } else if (arg === "--network" || arg === "-n") {
            let value = args[++i];
            if (!value || value.startsWith("-")) {
                throw new Error("--network flag requires a value");
            }

            // Normalize network aliases
            const networkAliases: Record<string, NetworkOption> = {
                "solana-devnet": "solana",
                "base-sepolia": "base",
                "base-devnet": "base",
                "skale-devnet": "skale",
                "skale-testnet": "skale",
            };
            if (networkAliases[value]) {
                value = networkAliases[value];
            }

            if (!VALID_NETWORKS.includes(value as NetworkOption)) {
                throw new Error(`Invalid network "${value}". Valid options: ${VALID_NETWORKS.join(", ")}`);
            }
            network = value as NetworkOption;
        } else if (arg === "--timeout" || arg === "-t") {
            const value = args[++i];
            if (!value) {
                throw new Error("--timeout flag requires a value in milliseconds");
            }
            // Check if value contains decimal point (not allowed)
            if (value.includes('.')) {
                throw new Error(`--timeout must be a positive number. Received: ${value}`);
            }
            const timeoutValue = parseInt(value, 10);
            if (isNaN(timeoutValue) || timeoutValue <= 0) {
                throw new Error(`--timeout must be a positive number. Received: ${value}`);
            }
            timeout = timeoutValue;
        } else if (!arg.startsWith("-")) {
            // Positional arguments: first is URL, second is body
            if (!targetUrl || targetUrl === DEFAULT_TARGET_URL) {
                // Check if it looks like a URL
                if (arg.startsWith("http://") || arg.startsWith("https://") || arg.includes("localhost")) {
                    targetUrl = arg;
                } else if (!requestBody) {
                    // Assume it's a JSON body if not a URL
                    requestBody = arg;
                }
            } else if (!requestBody) {
                requestBody = arg;
            }
        }
    }

    return { targetUrl, requestBody, network, timeout, filePath };
}

/**
 * Validate URL protocol
 * @param url - URL string to validate
 * @throws Error if URL is invalid or uses dangerous protocol
 */
export function validateUrl(url: string): void {
    try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error(`Invalid protocol: ${parsedUrl.protocol}. Expected http:// or https://`);
        }
    } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('Invalid URL')) {
            throw new Error(`Invalid URL format: ${url}`);
        }
        throw e;
    }
}

/**
 * Validate JSON string
 * @param jsonString - JSON string to validate
 * @throws Error if JSON is malformed
 */
export function validateJson(jsonString: string): void {
    try {
        JSON.parse(jsonString);
    } catch (e) {
        // Check if the string looks like a network name that was passed without --network flag
        const networkNames = ["solana", "solana-mainnet", "solana-devnet", "base", "base-mainnet", "base-sepolia", "skale", "skale-mainnet", "skale-devnet", "skale-testnet"];
        if (networkNames.includes(jsonString.toLowerCase().trim())) {
            throw new Error(
                `Invalid JSON format. Did you mean to use --network ${jsonString}?\n` +
                `   Correct usage: npm start <url> --network ${jsonString}\n` +
                `   You passed "${jsonString}" as a request body, but it looks like a network name.`
            );
        }
        throw new Error(`Invalid JSON format`);
    }
}

// Network configuration types and constants
export type NetworkType = 'svm' | 'evm';

/**
 * CAIP-2 chain identifier format: namespace:reference
 * Examples: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "eip155:8453"
 */
export type Caip2ChainId = `${string}:${string}`;

export interface NetworkConfig {
    type: NetworkType;
    chainId: Caip2ChainId;
    asset: string;
    isMainnet: boolean;
}

// Network Chain IDs (CAIP-2 format) - Source: https://docs.kobaru.io/concepts/networks-assets
const SOLANA_MAINNET_CHAIN_ID: Caip2ChainId = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const SOLANA_DEVNET_CHAIN_ID: Caip2ChainId = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const BASE_MAINNET_CHAIN_ID: Caip2ChainId = "eip155:8453";
const BASE_SEPOLIA_CHAIN_ID: Caip2ChainId = "eip155:84532";
const SKALE_MAINNET_CHAIN_ID: Caip2ChainId = "eip155:1187947933";
const SKALE_SEPOLIA_CHAIN_ID: Caip2ChainId = "eip155:324705682"; // SKALE Base Sepolia testnet

// USDC Token Addresses - Source: https://docs.kobaru.io/concepts/networks-assets
const SOLANA_MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const BASE_MAINNET_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const SKALE_MAINNET_USDC = "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20";
const SKALE_SEPOLIA_USDC = "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD";

/**
 * Get network configuration for a given network option
 * @param network - Network option
 * @returns Network configuration
 */
export function getNetworkConfig(network: NetworkOption): NetworkConfig {
    const configs: Record<NetworkOption, NetworkConfig> = {
        "solana-mainnet": {
            type: 'svm',
            chainId: SOLANA_MAINNET_CHAIN_ID,
            asset: SOLANA_MAINNET_USDC,
            isMainnet: true,
        },
        "solana": {
            type: 'svm',
            chainId: SOLANA_DEVNET_CHAIN_ID,
            asset: SOLANA_DEVNET_USDC,
            isMainnet: false,
        },
        "base-mainnet": {
            type: 'evm',
            chainId: BASE_MAINNET_CHAIN_ID,
            asset: BASE_MAINNET_USDC,
            isMainnet: true,
        },
        "base": {
            type: 'evm',
            chainId: BASE_SEPOLIA_CHAIN_ID,
            asset: BASE_SEPOLIA_USDC,
            isMainnet: false,
        },
        "skale-mainnet": {
            type: 'evm',
            chainId: SKALE_MAINNET_CHAIN_ID,
            asset: SKALE_MAINNET_USDC,
            isMainnet: true,
        },
        "skale": {
            type: 'evm',
            chainId: SKALE_SEPOLIA_CHAIN_ID,
            asset: SKALE_SEPOLIA_USDC,
            isMainnet: false,
        },
    };

    return configs[network];
}
