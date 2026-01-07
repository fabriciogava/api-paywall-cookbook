export class TranscriptNotFoundError extends Error {
    constructor(identifier: string, customMessage?: string) {
        super(customMessage || `Transcript not found for: ${identifier}`);
        this.name = "TranscriptNotFoundError";
    }
}

export class TranscriptEmptyError extends Error {
    constructor(identifier: string) {
        super(`Transcript exists but is empty for: ${identifier}`);
        this.name = "TranscriptEmptyError";
    }
}

export class InvalidUrlError extends Error {
    constructor(reason: string) {
        super(`Invalid URL: ${reason}`);
        this.name = "InvalidUrlError";
    }
}
