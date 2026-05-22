/**
 * Pure-JS/TS SHA-256 Implementation for synchronous cryptographic hashing
 */
export function sha256(str: string): string {
  const hash = (words: number[], l: number) => {
    words[l >> 5] |= 0x80 << (24 - (l % 32));
    words[(((l + 64) >> 9) << 4) + 15] = l;

    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
        h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    const w = new Array(64);

    for (let i = 0; i < words.length; i += 16) {
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

      for (let j = 0; j < 64; j++) {
        if (j < 16) {
          w[j] = words[i + j];
        } else {
          const s0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^
                     ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^
                     (w[j - 15] >>> 3);
          const s1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^
                     ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^
                     (w[j - 2] >>> 10);
          w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
        }

        const ch = (e & f) ^ (~e & g);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const sigma0 = ((a >>> 2) | (a << 30)) ^
                       ((a >>> 13) | (a << 19)) ^
                       ((a >>> 22) | (a << 10));
        const sigma1 = ((e >>> 6) | (e << 26)) ^
                       ((e >>> 11) | (e << 21)) ^
                       ((e >>> 25) | (e << 7));
        
        const t1 = (h + sigma1 + ch + k[j] + w[j]) | 0;
        const t2 = (sigma0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }

      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }

    const hex = (n: number) => {
      const s = (n >>> 0).toString(16);
      return '00000000'.substring(s.length) + s;
    };

    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
  };

  const words: number[] = [];
  const s = unescape(encodeURIComponent(str));
  for (let i = 0; i < s.length; i++) {
    words[i >> 2] |= s.charCodeAt(i) << (24 - (i % 4) * 8);
  }

  return hash(words, s.length * 8);
}

/**
 * Standardizes an EVM Address (lowercase and trim)
 */
export function standardizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

/**
 * Hashes a standardized address leaf
 */
export function hashLeaf(address: string): string {
  const clean = standardizeAddress(address);
  // Hash the address string (e.g. "0x71c7656ec7ab88b098defb751b7401b5f6d8976f")
  return sha256(clean);
}

/**
 * Hashes a pair of parent nodes, sorting them alphabetically first
 * to match OpenZeppelin's MerkleProof.sol verification sorting.
 */
export function combineHash(hashA: string, hashB: string): string {
  const sorted = hashA <= hashB ? [hashA, hashB] : [hashB, hashA];
  return sha256(sorted[0] + sorted[1]);
}

/**
 * Merkle Tree Implementation
 */
export class MerkleTree {
  private leaves: string[] = [];
  private levels: string[][] = [];

  constructor(addresses: string[]) {
    // 1. Filter out duplicates and empty entries, standardize addresses
    const uniqueAddresses = Array.from(
      new Set(addresses.map(addr => standardizeAddress(addr)).filter(addr => /^0x[a-fA-F0-9]{40}$/.test(addr)))
    );

    if (uniqueAddresses.length === 0) {
      this.leaves = [];
      this.levels = [['']];
      return;
    }

    // 2. Map addresses to their leaf hashes
    const leafHashes = uniqueAddresses.map(addr => hashLeaf(addr));

    // 3. Sort leaf hashes alphabetically (standard in EVM Merkle trees to be order-independent)
    leafHashes.sort();
    this.leaves = leafHashes;

    // 4. Build all levels of the tree
    this.levels = [this.leaves];
    while (this.levels[this.levels.length - 1].length > 1) {
      const currentLevel = this.levels[this.levels.length - 1];
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          nextLevel.push(combineHash(currentLevel[i], currentLevel[i + 1]));
        } else {
          // If odd number of nodes in this level, carry the last node over to next level
          nextLevel.push(currentLevel[i]);
        }
      }
      this.levels.push(nextLevel);
    }
  }

  /**
   * Returns the hex representation of the Merkle Root
   */
  public getRoot(): string {
    if (this.leaves.length === 0) return '0x' + '0'.repeat(64);
    const root = this.levels[this.levels.length - 1][0];
    return '0x' + root;
  }

  /**
   * Generates a Merkle Proof for a given address
   */
  public getProof(address: string): string[] {
    const cleanAddress = standardizeAddress(address);
    const targetHash = hashLeaf(cleanAddress);
    let index = this.leaves.indexOf(targetHash);

    if (index === -1) {
      return [];
    }

    const proof: string[] = [];

    // Traverse up the tree from index
    for (let levelIndex = 0; levelIndex < this.levels.length - 1; levelIndex++) {
      const level = this.levels[levelIndex];
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;

      if (siblingIndex < level.length) {
        proof.push('0x' + level[siblingIndex]);
      }

      index = Math.floor(index / 2);
    }

    return proof;
  }

  /**
   * Verifies if a proof is valid for a given address leaf and root
   */
  public static verify(proof: string[], root: string, address: string): boolean {
    let computedHash = hashLeaf(standardizeAddress(address));
    const cleanRoot = root.toLowerCase().replace('0x', '');

    for (const proofElement of proof) {
      const cleanElement = proofElement.toLowerCase().replace('0x', '');
      computedHash = computedHash <= cleanElement
        ? sha256(computedHash + cleanElement)
        : sha256(cleanElement + computedHash);
    }

    return computedHash === cleanRoot;
  }
}
