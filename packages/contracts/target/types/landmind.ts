/**
 * Program IDL in camelCase format for TypeScript client usage
 */
export type Landmind = {
  address: "D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ";
  metadata: {
    name: "landmind";
    version: "0.1.0";
    spec: "0.1.0";
  };
  instructions: [
    {
      name: "initialize";
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [];
      args: [];
    },
    {
      name: "deployAgent";
      discriminator: [22, 182, 166, 188, 196, 126, 240, 66];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "treasury";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 114, 101, 97, 115, 117, 114, 121];
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [];
    },
    {
      name: "initializeVault";
      discriminator: [48, 191, 163, 44, 71, 129, 63, 164];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "vaultState";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101];
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [];
    },
    {
      name: "claimEarnings";
      discriminator: [49, 99, 161, 170, 22, 233, 54, 140];
      accounts: [
        {
          name: "claimer";
          writable: true;
          signer: true;
        },
        {
          name: "vaultState";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101];
              }
            ];
          };
        },
        {
          name: "treasury";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 114, 101, 97, 115, 117, 114, 121];
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
        {
          name: "proof";
          type: {
            vec: {
              array: ["u8", 32];
            };
          };
        }
      ];
    },
    {
      name: "pauseVault";
      discriminator: [250, 6, 228, 57, 6, 104, 19, 210];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "vaultState";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101];
              }
            ];
          };
        }
      ];
      args: [];
    },
    {
      name: "unpauseVault";
      discriminator: [125, 29, 213, 213, 114, 155, 125, 63];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "vaultState";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101];
              }
            ];
          };
        }
      ];
      args: [];
    },
    {
      name: "updateMerkleRoot";
      discriminator: [195, 173, 38, 60, 242, 203, 158, 93];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "vaultState";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101];
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "newRoot";
          type: {
            array: ["u8", 32];
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "config";
      discriminator: [155, 12, 170, 224, 30, 250, 204, 130];
    },
    {
      name: "feeVaultState";
      discriminator: [125, 202, 121, 230, 141, 148, 34, 178];
    }
  ];
  events: [
    {
      name: "AgentDeployedEvent";
      discriminator: [153, 70, 66, 233, 232, 141, 190, 229];
    },
    {
      name: "VaultInitializedEvent";
      discriminator: [203, 214, 91, 5, 185, 248, 192, 149];
    },
    {
      name: "ClaimEvent";
      discriminator: [93, 15, 70, 170, 48, 140, 212, 219];
    },
    {
      name: "VaultPausedEvent";
      discriminator: [75, 189, 120, 167, 117, 229, 155, 60];
    },
    {
      name: "VaultUnpausedEvent";
      discriminator: [131, 193, 72, 96, 27, 110, 75, 199];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "InsufficientPayment";
      msg: "Insufficient payment: 0.1 SOL required for agent deployment";
    },
    {
      code: 6001;
      name: "InvalidTreasury";
      msg: "Invalid treasury: the provided treasury account does not match the expected PDA";
    },
    {
      code: 6002;
      name: "Unauthorized";
      msg: "Unauthorized: only the authority can perform this action";
    },
    {
      code: 6003;
      name: "VaultPaused";
      msg: "Vault is paused";
    },
    {
      code: 6004;
      name: "BelowMinimumClaim";
      msg: "Amount below minimum claim (0.025 SOL)";
    },
    {
      code: 6005;
      name: "InvalidProof";
      msg: "Invalid Merkle proof";
    }
  ];
  types: [
    {
      name: "AgentDeployedEvent";
      type: {
        kind: "struct";
        fields: [
          { name: "owner"; type: "pubkey" },
          { name: "timestamp"; type: "i64" },
          { name: "agentIndex"; type: "u64" }
        ];
      };
    },
    {
      name: "Config";
      type: {
        kind: "struct";
        fields: [
          { name: "authority"; type: "pubkey" },
          { name: "deployCost"; type: "u64" },
          { name: "totalAgents"; type: "u64" },
          { name: "bump"; type: "u8" }
        ];
      };
    },
    {
      name: "FeeVaultState";
      type: {
        kind: "struct";
        fields: [
          { name: "authority"; type: "pubkey" },
          { name: "merkleRoot"; type: { array: ["u8", 32] } },
          { name: "totalDistributed"; type: "u64" },
          { name: "paused"; type: "bool" },
          { name: "bump"; type: "u8" }
        ];
      };
    },
    {
      name: "VaultInitializedEvent";
      type: {
        kind: "struct";
        fields: [
          { name: "authority"; type: "pubkey" },
          { name: "timestamp"; type: "i64" }
        ];
      };
    },
    {
      name: "ClaimEvent";
      type: {
        kind: "struct";
        fields: [
          { name: "claimer"; type: "pubkey" },
          { name: "amount"; type: "u64" },
          { name: "timestamp"; type: "i64" }
        ];
      };
    },
    {
      name: "VaultPausedEvent";
      type: {
        kind: "struct";
        fields: [
          { name: "authority"; type: "pubkey" },
          { name: "timestamp"; type: "i64" }
        ];
      };
    },
    {
      name: "VaultUnpausedEvent";
      type: {
        kind: "struct";
        fields: [
          { name: "authority"; type: "pubkey" },
          { name: "timestamp"; type: "i64" }
        ];
      };
    }
  ];
};

export const IDL: Landmind = {
  address: "D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ",
  metadata: {
    name: "landmind",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "initialize",
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
      accounts: [],
      args: [],
    },
    {
      name: "deployAgent",
      discriminator: [22, 182, 166, 188, 196, 126, 240, 66],
      accounts: [
        {
          name: "payer",
          writable: true,
          signer: true,
        },
        {
          name: "treasury",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [116, 114, 101, 97, 115, 117, 114, 121],
              },
            ],
          },
        },
        {
          name: "systemProgram",
          address: "11111111111111111111111111111111",
        },
      ],
      args: [],
    },
    {
      name: "initializeVault",
      discriminator: [48, 191, 163, 44, 71, 129, 63, 164],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
        },
        {
          name: "vaultState",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101],
              },
            ],
          },
        },
        {
          name: "systemProgram",
          address: "11111111111111111111111111111111",
        },
      ],
      args: [],
    },
    {
      name: "claimEarnings",
      discriminator: [49, 99, 161, 170, 22, 233, 54, 140],
      accounts: [
        {
          name: "claimer",
          writable: true,
          signer: true,
        },
        {
          name: "vaultState",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101],
              },
            ],
          },
        },
        {
          name: "treasury",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [116, 114, 101, 97, 115, 117, 114, 121],
              },
            ],
          },
        },
        {
          name: "systemProgram",
          address: "11111111111111111111111111111111",
        },
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
        {
          name: "proof",
          type: {
            vec: {
              array: ["u8", 32],
            },
          },
        },
      ],
    },
    {
      name: "pauseVault",
      discriminator: [250, 6, 228, 57, 6, 104, 19, 210],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
        },
        {
          name: "vaultState",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101],
              },
            ],
          },
        },
      ],
      args: [],
    },
    {
      name: "unpauseVault",
      discriminator: [125, 29, 213, 213, 114, 155, 125, 63],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
        },
        {
          name: "vaultState",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101],
              },
            ],
          },
        },
      ],
      args: [],
    },
    {
      name: "updateMerkleRoot",
      discriminator: [195, 173, 38, 60, 242, 203, 158, 93],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
        },
        {
          name: "vaultState",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [118, 97, 117, 108, 116, 95, 115, 116, 97, 116, 101],
              },
            ],
          },
        },
      ],
      args: [
        {
          name: "newRoot",
          type: {
            array: ["u8", 32],
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "config",
      discriminator: [155, 12, 170, 224, 30, 250, 204, 130],
    },
    {
      name: "feeVaultState",
      discriminator: [125, 202, 121, 230, 141, 148, 34, 178],
    },
  ],
  events: [
    {
      name: "AgentDeployedEvent",
      discriminator: [153, 70, 66, 233, 232, 141, 190, 229],
    },
    {
      name: "VaultInitializedEvent",
      discriminator: [203, 214, 91, 5, 185, 248, 192, 149],
    },
    {
      name: "ClaimEvent",
      discriminator: [93, 15, 70, 170, 48, 140, 212, 219],
    },
    {
      name: "VaultPausedEvent",
      discriminator: [75, 189, 120, 167, 117, 229, 155, 60],
    },
    {
      name: "VaultUnpausedEvent",
      discriminator: [131, 193, 72, 96, 27, 110, 75, 199],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InsufficientPayment",
      msg: "Insufficient payment: 0.1 SOL required for agent deployment",
    },
    {
      code: 6001,
      name: "InvalidTreasury",
      msg: "Invalid treasury: the provided treasury account does not match the expected PDA",
    },
    {
      code: 6002,
      name: "Unauthorized",
      msg: "Unauthorized: only the authority can perform this action",
    },
    {
      code: 6003,
      name: "VaultPaused",
      msg: "Vault is paused",
    },
    {
      code: 6004,
      name: "BelowMinimumClaim",
      msg: "Amount below minimum claim (0.025 SOL)",
    },
    {
      code: 6005,
      name: "InvalidProof",
      msg: "Invalid Merkle proof",
    },
  ],
  types: [
    {
      name: "AgentDeployedEvent",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "timestamp", type: "i64" },
          { name: "agentIndex", type: "u64" },
        ],
      },
    },
    {
      name: "Config",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "deployCost", type: "u64" },
          { name: "totalAgents", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "FeeVaultState",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "merkleRoot", type: { array: ["u8", 32] } },
          { name: "totalDistributed", type: "u64" },
          { name: "paused", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "VaultInitializedEvent",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "timestamp", type: "i64" },
        ],
      },
    },
    {
      name: "ClaimEvent",
      type: {
        kind: "struct",
        fields: [
          { name: "claimer", type: "pubkey" },
          { name: "amount", type: "u64" },
          { name: "timestamp", type: "i64" },
        ],
      },
    },
    {
      name: "VaultPausedEvent",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "timestamp", type: "i64" },
        ],
      },
    },
    {
      name: "VaultUnpausedEvent",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "timestamp", type: "i64" },
        ],
      },
    },
  ],
};

/** Constants for the LandMind program */
export const PROGRAM_ID = "D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ";
export const DEPLOY_COST_LAMPORTS = 100_000_000; // 0.1 SOL
export const MIN_CLAIM_LAMPORTS = 25_000_000; // 0.025 SOL
export const TREASURY_SEED = "treasury";
export const VAULT_STATE_SEED = "vault_state";
