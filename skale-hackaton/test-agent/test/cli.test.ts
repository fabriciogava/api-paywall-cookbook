import { describe, it, expect } from 'vitest';
import {
    parseArgs,
    validateUrl,
    validateJson,
    getNetworkConfig,
    type NetworkOption,
} from '../src/cli';

describe('parseArgs', () => {
    describe('URL parsing', () => {
        it('should use default URL when no arguments provided', () => {
            const result = parseArgs({ args: [] });
            expect(result.targetUrl).toBe('http://localhost:3000/answer');
        });

        it('should parse HTTP URL from arguments', () => {
            const result = parseArgs({ args: ['http://example.com/api'] });
            expect(result.targetUrl).toBe('http://example.com/api');
        });

        it('should parse HTTPS URL from arguments', () => {
            const result = parseArgs({ args: ['https://secure.example.com/endpoint'] });
            expect(result.targetUrl).toBe('https://secure.example.com/endpoint');
        });

        it('should parse localhost URL', () => {
            const result = parseArgs({ args: ['http://localhost:8080/test'] });
            expect(result.targetUrl).toBe('http://localhost:8080/test');
        });

        it('should use custom default URL', () => {
            const result = parseArgs({
                args: [],
                defaultUrl: 'http://custom.com/endpoint'
            });
            expect(result.targetUrl).toBe('http://custom.com/endpoint');
        });
    });

    describe('Network flag parsing', () => {
        it('should parse --network flag with solana', () => {
            const result = parseArgs({ args: ['--network', 'solana'] });
            expect(result.network).toBe('solana');
        });

        it('should parse -n short form', () => {
            const result = parseArgs({ args: ['-n', 'base'] });
            expect(result.network).toBe('base');
        });

        it('should parse solana-mainnet', () => {
            const result = parseArgs({ args: ['--network', 'solana-mainnet'] });
            expect(result.network).toBe('solana-mainnet');
        });

        it('should parse base-mainnet', () => {
            const result = parseArgs({ args: ['--network', 'base-mainnet'] });
            expect(result.network).toBe('base-mainnet');
        });

        it('should normalize solana-devnet alias to solana', () => {
            const result = parseArgs({ args: ['--network', 'solana-devnet'] });
            expect(result.network).toBe('solana');
        });

        it('should normalize base-sepolia alias to base', () => {
            const result = parseArgs({ args: ['--network', 'base-sepolia'] });
            expect(result.network).toBe('base');
        });

        it('should normalize base-devnet alias to base', () => {
            const result = parseArgs({ args: ['--network', 'base-devnet'] });
            expect(result.network).toBe('base');
        });

        it('should throw error when --network has no value', () => {
            expect(() => parseArgs({ args: ['--network'] }))
                .toThrow('--network flag requires a value');
        });

        it('should throw error when --network value starts with dash', () => {
            expect(() => parseArgs({ args: ['--network', '--other'] }))
                .toThrow('--network flag requires a value');
        });

        it('should throw error for invalid network name', () => {
            expect(() => parseArgs({ args: ['--network', 'ethereum'] }))
                .toThrow('Invalid network "ethereum"');
        });
    });

    describe('Timeout flag parsing', () => {
        it('should parse --timeout flag', () => {
            const result = parseArgs({ args: ['--timeout', '30000'] });
            expect(result.timeout).toBe(30000);
        });

        it('should parse -t short form', () => {
            const result = parseArgs({ args: ['-t', '5000'] });
            expect(result.timeout).toBe(5000);
        });

        it('should parse large timeout values', () => {
            const result = parseArgs({ args: ['--timeout', '300000'] });
            expect(result.timeout).toBe(300000);
        });

        it('should throw error when --timeout has no value', () => {
            expect(() => parseArgs({ args: ['--timeout'] }))
                .toThrow('--timeout flag requires a value');
        });

        it('should throw error when --timeout value starts with dash', () => {
            expect(() => parseArgs({ args: ['--timeout', '--other'] }))
                .toThrow('--timeout must be a positive number');
        });

        it('should throw error for non-numeric timeout', () => {
            expect(() => parseArgs({ args: ['--timeout', 'abc'] }))
                .toThrow('--timeout must be a positive number');
        });

        it('should throw error for negative timeout', () => {
            expect(() => parseArgs({ args: ['--timeout', '-100'] }))
                .toThrow('--timeout must be a positive number');
        });

        it('should throw error for zero timeout', () => {
            expect(() => parseArgs({ args: ['--timeout', '0'] }))
                .toThrow('--timeout must be a positive number');
        });

        it('should throw error for decimal timeout', () => {
            expect(() => parseArgs({ args: ['--timeout', '1.5'] }))
                .toThrow('--timeout must be a positive number');
        });
    });

    describe('Request body parsing', () => {
        it('should parse JSON body as second positional argument', () => {
            const result = parseArgs({ args: [
                'http://localhost:3000/api',
                '{"key":"value"}'
            ] });
            expect(result.requestBody).toBe('{"key":"value"}');
        });

        it('should parse body when URL is not explicitly provided', () => {
            const result = parseArgs({ args: ['{"test":true}'] });
            expect(result.requestBody).toBe('{"test":true}');
            expect(result.targetUrl).toBe('http://localhost:3000/answer');
        });
    });

    describe('Combined arguments', () => {
        it('should parse URL, network, and timeout together', () => {
            const result = parseArgs({ args: [
                'https://api.example.com/test',
                '--network', 'solana',
                '--timeout', '60000'
            ] });
            expect(result.targetUrl).toBe('https://api.example.com/test');
            expect(result.network).toBe('solana');
            expect(result.timeout).toBe(60000);
        });

        it('should parse all arguments including body', () => {
            const result = parseArgs({ args: [
                'https://api.example.com/test',
                '{"data":"test"}',
                '--network', 'base-mainnet',
                '-t', '30000'
            ] });
            expect(result.targetUrl).toBe('https://api.example.com/test');
            expect(result.requestBody).toBe('{"data":"test"}');
            expect(result.network).toBe('base-mainnet');
            expect(result.timeout).toBe(30000);
        });

        it('should handle flags in any order', () => {
            const result = parseArgs({ args: [
                '--timeout', '10000',
                'http://test.com',
                '--network', 'solana',
            ] });
            expect(result.targetUrl).toBe('http://test.com');
            expect(result.network).toBe('solana');
            expect(result.timeout).toBe(10000);
        });
    });

    describe('Edge cases', () => {
        it('should return default URL when only flags provided', () => {
            const result = parseArgs({ args: ['--network', 'solana'] });
            expect(result.targetUrl).toBe('http://localhost:3000/answer');
        });

        it('should handle empty args array', () => {
            const result = parseArgs({ args: [] });
            expect(result.targetUrl).toBe('http://localhost:3000/answer');
            expect(result.network).toBeUndefined();
            expect(result.timeout).toBeUndefined();
            expect(result.requestBody).toBeUndefined();
        });

        it('should preserve original URL when flags come after', () => {
            const result = parseArgs({ args: [
                'http://localhost:9000/test',
                '--network', 'base'
            ] });
            expect(result.targetUrl).toBe('http://localhost:9000/test');
        });
    });
});

describe('validateUrl', () => {
    it('should accept valid HTTP URL', () => {
        expect(() => validateUrl('http://example.com')).not.toThrow();
    });

    it('should accept valid HTTPS URL', () => {
        expect(() => validateUrl('https://secure.example.com')).not.toThrow();
    });

    it('should accept localhost URL', () => {
        expect(() => validateUrl('http://localhost:3000')).not.toThrow();
    });

    it('should accept URL with path', () => {
        expect(() => validateUrl('https://api.example.com/v1/endpoint')).not.toThrow();
    });

    it('should accept URL with query params', () => {
        expect(() => validateUrl('https://api.example.com/test?key=value')).not.toThrow();
    });

    it('should reject file:// protocol', () => {
        expect(() => validateUrl('file:///etc/passwd'))
            .toThrow('Invalid protocol: file:');
    });

    it('should reject javascript: protocol', () => {
        expect(() => validateUrl('javascript:alert(1)'))
            .toThrow('Invalid protocol: javascript:');
    });

    it('should reject data: protocol', () => {
        expect(() => validateUrl('data:text/html,<script>alert(1)</script>'))
            .toThrow('Invalid protocol: data:');
    });

    it('should reject ftp:// protocol', () => {
        expect(() => validateUrl('ftp://ftp.example.com'))
            .toThrow('Invalid protocol: ftp:');
    });

    it('should reject malformed URLs', () => {
        expect(() => validateUrl('not-a-url'))
            .toThrow('Invalid URL format');
    });

    it('should reject empty URLs', () => {
        expect(() => validateUrl(''))
            .toThrow('Invalid URL format');
    });
});

describe('validateJson', () => {
    it('should accept valid JSON object', () => {
        expect(() => validateJson('{"key":"value"}')).not.toThrow();
    });

    it('should accept valid JSON array', () => {
        expect(() => validateJson('[1,2,3]')).not.toThrow();
    });

    it('should accept JSON with nested objects', () => {
        expect(() => validateJson('{"user":{"name":"test","age":25}}')).not.toThrow();
    });

    it('should accept JSON with booleans', () => {
        expect(() => validateJson('{"active":true,"deleted":false}')).not.toThrow();
    });

    it('should accept JSON with null', () => {
        expect(() => validateJson('{"value":null}')).not.toThrow();
    });

    it('should accept empty JSON object', () => {
        expect(() => validateJson('{}')).not.toThrow();
    });

    it('should accept empty JSON array', () => {
        expect(() => validateJson('[]')).not.toThrow();
    });

    it('should reject malformed JSON - missing closing brace', () => {
        expect(() => validateJson('{"key":"value"'))
            .toThrow('Invalid JSON format');
    });

    it('should reject malformed JSON - trailing comma', () => {
        expect(() => validateJson('{"key":"value",}'))
            .toThrow('Invalid JSON format');
    });

    it('should reject malformed JSON - single quotes', () => {
        expect(() => validateJson("{'key':'value'}"))
            .toThrow('Invalid JSON format');
    });

    it('should reject plain text', () => {
        expect(() => validateJson('not json'))
            .toThrow('Invalid JSON format');
    });

    it('should reject empty string', () => {
        expect(() => validateJson(''))
            .toThrow('Invalid JSON format');
    });
});

describe('getNetworkConfig', () => {
    describe('Solana networks', () => {
        it('should return correct config for solana (devnet)', () => {
            const config = getNetworkConfig('solana');
            expect(config.type).toBe('svm');
            expect(config.chainId).toBe('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1');
            expect(config.asset).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
            expect(config.isMainnet).toBe(false);
        });

        it('should return correct config for solana-mainnet', () => {
            const config = getNetworkConfig('solana-mainnet');
            expect(config.type).toBe('svm');
            expect(config.chainId).toBe('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
            expect(config.asset).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
            expect(config.isMainnet).toBe(true);
        });
    });

    describe('Base networks', () => {
        it('should return correct config for base (sepolia)', () => {
            const config = getNetworkConfig('base');
            expect(config.type).toBe('evm');
            expect(config.chainId).toBe('eip155:84532');
            expect(config.asset).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
            expect(config.isMainnet).toBe(false);
        });

        it('should return correct config for base-mainnet', () => {
            const config = getNetworkConfig('base-mainnet');
            expect(config.type).toBe('evm');
            expect(config.chainId).toBe('eip155:8453');
            expect(config.asset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
            expect(config.isMainnet).toBe(true);
        });
    });

    describe('Network type distinction', () => {
        it('should identify Solana as SVM type', () => {
            expect(getNetworkConfig('solana').type).toBe('svm');
            expect(getNetworkConfig('solana-mainnet').type).toBe('svm');
        });

        it('should identify Base as EVM type', () => {
            expect(getNetworkConfig('base').type).toBe('evm');
            expect(getNetworkConfig('base-mainnet').type).toBe('evm');
        });
    });

    describe('Mainnet detection', () => {
        it('should correctly identify mainnet networks', () => {
            expect(getNetworkConfig('solana-mainnet').isMainnet).toBe(true);
            expect(getNetworkConfig('base-mainnet').isMainnet).toBe(true);
        });

        it('should correctly identify testnet networks', () => {
            expect(getNetworkConfig('solana').isMainnet).toBe(false);
            expect(getNetworkConfig('base').isMainnet).toBe(false);
        });
    });
});
