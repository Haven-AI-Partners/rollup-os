import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto";

describe("encrypt / decrypt", () => {
  it("roundtrips plaintext correctly", () => {
    const plaintext = "my-secret-refresh-token-12345";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("roundtrips empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("roundtrips unicode text", () => {
    const plaintext = "日本語テスト token 🔑";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("roundtrips long text", () => {
    const plaintext = "x".repeat(10000);
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("encrypted format is iv:tag:ciphertext (hex)", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV is 12 bytes = 24 hex chars
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
    // Auth tag is 16 bytes = 32 hex chars
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    // Ciphertext is non-empty hex
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    // Flip every byte in the ciphertext to guarantee corruption
    const flipped = parts[2]
      .split("")
      .map((c) => (c === "f" ? "0" : "f"))
      .join("");
    const tampered = parts[0] + ":" + parts[1] + ":" + flipped;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on tampered auth tag", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    const tampered = parts[0] + ":00000000000000000000000000000000:" + parts[2];
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when encryption key is missing", () => {
    const original = process.env.GOOGLE_DRIVE_ENCRYPTION_KEY;
    delete process.env.GOOGLE_DRIVE_ENCRYPTION_KEY;
    try {
      expect(() => encrypt("test")).toThrow("GOOGLE_DRIVE_ENCRYPTION_KEY");
    } finally {
      process.env.GOOGLE_DRIVE_ENCRYPTION_KEY = original;
    }
  });

  it("throws when encryption key is wrong length", () => {
    const original = process.env.GOOGLE_DRIVE_ENCRYPTION_KEY;
    process.env.GOOGLE_DRIVE_ENCRYPTION_KEY = "tooshort";
    try {
      expect(() => encrypt("test")).toThrow("64-char hex string");
    } finally {
      process.env.GOOGLE_DRIVE_ENCRYPTION_KEY = original;
    }
  });
});
