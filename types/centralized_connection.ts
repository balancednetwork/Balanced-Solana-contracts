/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/centralized_connection.json`.
 */
export type CentralizedConnection = {
  "address": "4vfkXyxMxptmREF3RaFKUwnPRuqsXJJeUFzpCjPSSVMb",
  "metadata": {
    "name": "centralizedConnection",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimFees",
      "discriminator": [
        82,
        251,
        233,
        156,
        12,
        52,
        184,
        202
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Rent payer"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "config"
          ],
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "getFee",
      "discriminator": [
        115,
        195,
        235,
        161,
        25,
        219,
        60,
        29
      ],
      "accounts": [
        {
          "name": "networkFee",
          "docs": [
            "Fee"
          ]
        }
      ],
      "args": [
        {
          "name": "networkId",
          "type": "string"
        },
        {
          "name": "response",
          "type": "bool"
        }
      ],
      "returns": "u64"
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "Rent payer"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "docs": [
            "System Program: Required for creating the centralized-connection config"
          ]
        },
        {
          "name": "config",
          "docs": [
            "config"
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "xcall",
          "type": "pubkey"
        },
        {
          "name": "admin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "queryRecvMessageAccounts",
      "discriminator": [
        36,
        243,
        79,
        158,
        41,
        247,
        134,
        15
      ],
      "accounts": [
        {
          "name": "config"
        }
      ],
      "args": [
        {
          "name": "srcNetwork",
          "type": "string"
        },
        {
          "name": "connSn",
          "type": "u128"
        },
        {
          "name": "msg",
          "type": "bytes"
        },
        {
          "name": "sequenceNo",
          "type": "u128"
        },
        {
          "name": "page",
          "type": "u8"
        },
        {
          "name": "limit",
          "type": "u8"
        }
      ],
      "returns": {
        "defined": {
          "name": "queryAccountsPaginateResponse"
        }
      }
    },
    {
      "name": "queryRevertMessageAccounts",
      "discriminator": [
        224,
        208,
        135,
        17,
        98,
        199,
        169,
        130
      ],
      "accounts": [
        {
          "name": "config"
        }
      ],
      "args": [
        {
          "name": "sequenceNo",
          "type": "u128"
        },
        {
          "name": "page",
          "type": "u8"
        },
        {
          "name": "limit",
          "type": "u8"
        }
      ],
      "returns": {
        "defined": {
          "name": "queryAccountsPaginateResponse"
        }
      }
    },
    {
      "name": "querySendMessageAccounts",
      "discriminator": [
        194,
        5,
        35,
        74,
        234,
        41,
        109,
        44
      ],
      "accounts": [
        {
          "name": "config"
        }
      ],
      "args": [
        {
          "name": "dstNetwork",
          "type": "string"
        }
      ],
      "returns": {
        "defined": {
          "name": "queryAccountsResponse"
        }
      }
    },
    {
      "name": "recvMessage",
      "discriminator": [
        49,
        210,
        56,
        132,
        17,
        157,
        18,
        123
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "config",
          "docs": [
            "config"
          ],
          "writable": true
        },
        {
          "name": "receipt",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "srcNetwork",
          "type": "string"
        },
        {
          "name": "connSn",
          "type": "u128"
        },
        {
          "name": "msg",
          "type": "bytes"
        },
        {
          "name": "sequenceNo",
          "type": "u128"
        }
      ]
    },
    {
      "name": "revertMessage",
      "discriminator": [
        180,
        122,
        6,
        78,
        54,
        195,
        160,
        114
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "config",
          "docs": [
            "config"
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "sequenceNo",
          "type": "u128"
        }
      ]
    },
    {
      "name": "sendMessage",
      "discriminator": [
        57,
        40,
        34,
        178,
        189,
        10,
        65,
        26
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "xcall",
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "networkFee"
        }
      ],
      "args": [
        {
          "name": "to",
          "type": "string"
        },
        {
          "name": "sn",
          "type": "i64"
        },
        {
          "name": "msg",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "setAdmin",
      "discriminator": [
        251,
        163,
        0,
        52,
        91,
        194,
        187,
        92
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Transaction signer"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "config"
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "account",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setFee",
      "discriminator": [
        18,
        154,
        24,
        18,
        237,
        214,
        19,
        80
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Rent payer"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "docs": [
            "System Program: Required to create program-derived address"
          ]
        },
        {
          "name": "networkFee",
          "docs": [
            "Fee"
          ],
          "writable": true
        },
        {
          "name": "config",
          "docs": [
            "config"
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "networkId",
          "type": "string"
        },
        {
          "name": "messageFee",
          "type": "u64"
        },
        {
          "name": "responseFee",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "networkFee",
      "discriminator": [
        28,
        210,
        65,
        10,
        120,
        209,
        12,
        32
      ]
    },
    {
      "name": "receipt",
      "discriminator": [
        39,
        154,
        73,
        106,
        80,
        102,
        145,
        153
      ]
    }
  ],
  "events": [
    {
      "name": "sendMessage",
      "discriminator": [
        146,
        38,
        13,
        221,
        87,
        214,
        247,
        12
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "onlyAdmin",
      "msg": "Only admin"
    },
    {
      "code": 6001,
      "name": "onlyXcall",
      "msg": "Only xcall"
    }
  ],
  "types": [
    {
      "name": "accountMetadata",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "pubkey"
          },
          {
            "name": "isWritable",
            "type": "bool"
          },
          {
            "name": "isSigner",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "config",
      "docs": [
        "The `Config` state of the centralized connection - the inner data of the",
        "program-derived address"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "xcall",
            "type": "pubkey"
          },
          {
            "name": "sn",
            "type": "u128"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "networkFee",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "messageFee",
            "type": "u64"
          },
          {
            "name": "responseFee",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "queryAccountsPaginateResponse",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "accounts",
            "type": {
              "vec": {
                "defined": {
                  "name": "accountMetadata"
                }
              }
            }
          },
          {
            "name": "totalAccounts",
            "type": "u8"
          },
          {
            "name": "limit",
            "type": "u8"
          },
          {
            "name": "page",
            "type": "u8"
          },
          {
            "name": "hasNextPage",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "queryAccountsResponse",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "accounts",
            "type": {
              "vec": {
                "defined": {
                  "name": "accountMetadata"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "receipt",
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "sendMessage",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "targetNetwork",
            "type": "string"
          },
          {
            "name": "connSn",
            "type": "u128"
          },
          {
            "name": "msg",
            "type": "bytes"
          }
        ]
      }
    }
  ]
};
