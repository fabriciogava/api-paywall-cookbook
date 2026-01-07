/**
 * URL Validation Utility
 * 
 * Validates and normalizes YouTube URLs to prevent fetching malicious content.
 * Uses a domain allowlist sourced from v2fly/domain-list-community.
 */

import { InvalidUrlError } from "../entities/Errors.js";

// Legitimate YouTube domains from https://github.com/v2fly/domain-list-community
// These are the primary domains used for video URLs
const YOUTUBE_DOMAINS = new Set([
    // Primary domains
    "youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
    // Regional domains (alphabetically sorted)
    "youtube.ae", "youtube.al", "youtube.am", "youtube.at", "youtube.az",
    "youtube.ba", "youtube.be", "youtube.bg", "youtube.bh", "youtube.bo", "youtube.by",
    "youtube.ca", "youtube.cat", "youtube.ch", "youtube.cl", "youtube.co", "youtube.cr", "youtube.cz",
    "youtube.de", "youtube.dk",
    "youtube.ee", "youtube.es",
    "youtube.fi", "youtube.fr",
    "youtube.ge", "youtube.gr", "youtube.gt",
    "youtube.hk", "youtube.hr", "youtube.hu",
    "youtube.ie", "youtube.in", "youtube.iq", "youtube.is", "youtube.it",
    "youtube.jo", "youtube.jp",
    "youtube.kr", "youtube.kz",
    "youtube.la", "youtube.lk", "youtube.lt", "youtube.lu", "youtube.lv", "youtube.ly",
    "youtube.ma", "youtube.md", "youtube.me", "youtube.mk", "youtube.mn", "youtube.mx", "youtube.my",
    "youtube.ng", "youtube.ni", "youtube.nl", "youtube.no",
    "youtube.pa", "youtube.pe", "youtube.ph", "youtube.pk", "youtube.pl", "youtube.pr", "youtube.pt",
    "youtube.qa",
    "youtube.ro", "youtube.rs", "youtube.ru",
    "youtube.sa", "youtube.se", "youtube.sg", "youtube.si", "youtube.sk", "youtube.sn", "youtube.soy", "youtube.sv",
    "youtube.tn", "youtube.tv",
    "youtube.ua", "youtube.ug", "youtube.uy",
    "youtube.vn",
    // Compound regional domains
    "youtube.co.ae", "youtube.co.at", "youtube.co.cr", "youtube.co.hu", "youtube.co.id",
    "youtube.co.il", "youtube.co.in", "youtube.co.jp", "youtube.co.ke", "youtube.co.kr",
    "youtube.co.ma", "youtube.co.nz", "youtube.co.th", "youtube.co.tz", "youtube.co.ug",
    "youtube.co.uk", "youtube.co.ve", "youtube.co.za", "youtube.co.zw",
    "youtube.com.ar", "youtube.com.au", "youtube.com.az", "youtube.com.bd", "youtube.com.bh",
    "youtube.com.bo", "youtube.com.br", "youtube.com.by", "youtube.com.co", "youtube.com.do",
    "youtube.com.ec", "youtube.com.ee", "youtube.com.eg", "youtube.com.es", "youtube.com.gh",
    "youtube.com.gr", "youtube.com.gt", "youtube.com.hk", "youtube.com.hn", "youtube.com.hr",
    "youtube.com.jm", "youtube.com.jo", "youtube.com.kw", "youtube.com.lb", "youtube.com.lv",
    "youtube.com.ly", "youtube.com.mk", "youtube.com.mt", "youtube.com.mx", "youtube.com.my",
    "youtube.com.ng", "youtube.com.ni", "youtube.com.om", "youtube.com.pa", "youtube.com.pe",
    "youtube.com.ph", "youtube.com.pk", "youtube.com.pt", "youtube.com.py", "youtube.com.qa",
    "youtube.com.ro", "youtube.com.sa", "youtube.com.sg", "youtube.com.sv", "youtube.com.tn",
    "youtube.com.tr", "youtube.com.tw", "youtube.com.ua", "youtube.com.uy", "youtube.com.ve",
]);

/**
 * Validates that a URL is a legitimate YouTube URL and normalizes it to use HTTPS.
 * 
 * @param input - The raw URL input from the user (may or may not have protocol)
 * @returns The normalized URL with HTTPS
 * @throws InvalidUrlError if the URL is not a recognized YouTube domain
 */
export function validateAndNormalizeYouTubeUrl(input: string): string {
    if (!input || typeof input !== "string") {
        throw new InvalidUrlError("URL is required");
    }

    // Trim whitespace
    let urlString = input.trim();

    // Normalize protocol: add https:// if missing, replace http:// with https://
    if (urlString.startsWith("http://")) {
        urlString = urlString.replace("http://", "https://");
    } else if (!urlString.startsWith("https://")) {
        // No protocol provided, assume https
        urlString = "https://" + urlString;
    }

    // Parse URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(urlString);
    } catch {
        throw new InvalidUrlError("Invalid URL format");
    }

    // Extract hostname and remove www. prefix if present
    let hostname = parsedUrl.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
        hostname = hostname.slice(4);
    }

    // Validate hostname against allowlist
    if (!YOUTUBE_DOMAINS.has(hostname)) {
        throw new InvalidUrlError(`Not a recognized YouTube domain: ${hostname}`);
    }

    // Return the normalized URL
    return parsedUrl.toString();
}
