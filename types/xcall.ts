/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/xcall.json`.
 */
export type Xcall = {
  "address": "3489r9oW63a8MRk5CXD2Lv8YTFQ9iGjaXxgGnaoccPhc",
  "metadata": {
    "name": "xcall",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "decodeCsMessage",
      "discriminator": [
        144,
        173,
        76,
        110,
        143,
        132,
        199,
        222
      ],
      "accounts": [],
      "args": [
        {
          "name": "message",
          "type": "bytes"
        }
      ],
      "returns": {
        "defined": {
          "name": "csMessageDecoded"
        }
      }
    },
    {
      "name": "executeCall",
      "discriminator": [
        62,
        92,
        205,
        53,
        148,
        71,
        217,
        96
      ],
      "accounts": [
        {
          "name": "proxyRequests",
          "writable": true,
          "optional": true
        },
        {
          "name": "replyState",
          "writable": true,
          "optional": true
        },
        {
          "name": "defaultConnection"
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "reqId",
          "type": "u128"
        },
        {
          "name": "data",
          "type": "bytes"
        },
        {
          "name": "nid",
          "type": "string"
        }
      ]
    },
    {
      "name": "executeRollback",
      "discriminator": [
        10,
        217,
        27,
        106,
        53,
        35,
        82,
        17
      ],
      "accounts": [
        {
          "name": "rollback",
          "writable": true,
          "optional": true
        },
        {
          "name": "defaultConnection",
          "writable": true,
          "optional": true
        },
        {
          "name": "owner",
          "docs": [
            "CHECK : need to be the owner of the pda"
          ],
          "writable": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "sn",
          "type": "u128"
        }
      ]
    },
    {
      "name": "getAdmin",
      "discriminator": [
        136,
        243,
        64,
        106,
        205,
        81,
        211,
        193
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [],
      "returns": "pubkey"
    },
    {
      "name": "getDefaultConnection",
      "discriminator": [
        144,
        154,
        189,
        172,
        38,
        195,
        153,
        14
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "nid",
          "type": "string"
        }
      ],
      "returns": "pubkey"
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
          "name": "config"
        },
        {
          "name": "defaultConnection"
        },
        {
          "name": "reply"
        }
      ],
      "args": [
        {
          "name": "nid",
          "type": "string"
        },
        {
          "name": "rollback",
          "type": "bool"
        },
        {
          "name": "sources",
          "type": {
            "option": {
              "vec": "string"
            }
          }
        }
      ],
      "returns": "u64"
    },
    {
      "name": "getNetworkAddress",
      "discriminator": [
        30,
        225,
        18,
        117,
        173,
        233,
        193,
        79
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [],
      "returns": {
        "defined": {
          "name": "networkAddress"
        }
      }
    },
    {
      "name": "getProtocolFee",
      "discriminator": [
        196,
        255,
        35,
        46,
        240,
        44,
        38,
        53
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [],
      "returns": "u64"
    },
    {
      "name": "getProtocolFeeHandler",
      "discriminator": [
        67,
        5,
        253,
        223,
        144,
        117,
        8,
        95
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [],
      "returns": "pubkey"
    },
    {
      "name": "handleError",
      "discriminator": [
        4,
        46,
        187,
        49,
        241,
        125,
        121,
        119
      ],
      "accounts": [
        {
          "name": "connection",
          "signer": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "defaultConnection"
        },
        {
          "name": "pendingResponse",
          "writable": true,
          "optional": true
        },
        {
          "name": "pendingResponseCreator",
          "writable": true,
          "optional": true
        },
        {
          "name": "rollbackAccount",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "fromNid",
          "type": "string"
        },
        {
          "name": "sequenceNo",
          "type": "u128"
        }
      ]
    },
    {
      "name": "handleMessage",
      "discriminator": [
        91,
        215,
        39,
        71,
        108,
        217,
        94,
        89
      ],
      "accounts": [
        {
          "name": "connection",
          "signer": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram"
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "proxyRequest",
          "writable": true
        },
        {
          "name": "defaultConnection"
        },
        {
          "name": "pendingRequest",
          "writable": true,
          "optional": true
        },
        {
          "name": "pendingRequestCreator",
          "writable": true,
          "optional": true
        },
        {
          "name": "pendingResponse",
          "writable": true,
          "optional": true
        },
        {
          "name": "pendingResponseCreator",
          "writable": true,
          "optional": true
        },
        {
          "name": "successfulResponse",
          "writable": true,
          "optional": true
        },
        {
          "name": "rollbackAccount",
          "optional": true
        },
        {
          "name": "rollbackCreator",
          "writable": true,
          "optional": true
        }
      ],
      "args": [
        {
          "name": "fromNid",
          "type": "string"
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
          "name": "config",
          "writable": true
        },
        {
          "name": "reply",
          "writable": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "networkId",
          "type": "string"
        }
      ]
    },
    {
      "name": "sendCall",
      "discriminator": [
        254,
        95,
        190,
        68,
        194,
        140,
        28,
        103
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
          "name": "config",
          "writable": true
        },
        {
          "name": "reply",
          "writable": true
        },
        {
          "name": "defaultConnection"
        },
        {
          "name": "feeHandler",
          "writable": true
        },
        {
          "name": "rollbackAccount",
          "writable": true,
          "optional": true
        }
      ],
      "args": [
        {
          "name": "envelope",
          "type": "bytes"
        },
        {
          "name": "to",
          "type": {
            "defined": {
              "name": "networkAddress"
            }
          }
        }
      ],
      "returns": "u128"
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
          "name": "config",
          "writable": true
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
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
      "name": "setDefaultConnection",
      "discriminator": [
        82,
        16,
        211,
        171,
        43,
        227,
        9,
        155
      ],
      "accounts": [
        {
          "name": "defaultConnection",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "networkId",
          "type": "string"
        },
        {
          "name": "connection",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setProtocolFee",
      "discriminator": [
        173,
        239,
        83,
        242,
        136,
        43,
        144,
        217
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "feeHandler",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "fee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setProtocolFeeHandler",
      "discriminator": [
        77,
        67,
        152,
        114,
        71,
        111,
        125,
        231
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "feeHandler",
          "type": "pubkey"
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
      "name": "defaultConnection",
      "discriminator": [
        157,
        235,
        105,
        62,
        249,
        244,
        234,
        110
      ]
    },
    {
      "name": "pendingRequest",
      "discriminator": [
        200,
        54,
        139,
        59,
        132,
        71,
        165,
        140
      ]
    },
    {
      "name": "pendingResponse",
      "discriminator": [
        208,
        29,
        212,
        56,
        57,
        21,
        102,
        91
      ]
    },
    {
      "name": "proxyRequest",
      "discriminator": [
        218,
        221,
        67,
        191,
        4,
        58,
        233,
        238
      ]
    },
    {
      "name": "reply",
      "discriminator": [
        94,
        7,
        30,
        141,
        234,
        119,
        194,
        246
      ]
    },
    {
      "name": "rollbackAccount",
      "discriminator": [
        134,
        57,
        189,
        69,
        204,
        145,
        207,
        114
      ]
    },
    {
      "name": "successfulResponse",
      "discriminator": [
        159,
        124,
        99,
        153,
        111,
        205,
        107,
        247
      ]
    }
  ],
  "events": [
    {
      "name": "callExecuted",
      "discriminator": [
        237,
        120,
        238,
        142,
        189,
        37,
        65,
        128
      ]
    },
    {
      "name": "callMessage",
      "discriminator": [
        125,
        100,
        225,
        111,
        72,
        201,
        186,
        123
      ]
    },
    {
      "name": "callMessageSent",
      "discriminator": [
        255,
        161,
        224,
        203,
        154,
        117,
        117,
        126
      ]
    },
    {
      "name": "responseMessage",
      "discriminator": [
        125,
        230,
        224,
        74,
        135,
        185,
        132,
        218
      ]
    },
    {
      "name": "rollbackExecuted",
      "discriminator": [
        50,
        154,
        60,
        223,
        193,
        198,
        62,
        240
      ]
    },
    {
      "name": "rollbackMessage",
      "discriminator": [
        207,
        120,
        146,
        208,
        75,
        64,
        28,
        168
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "onlyAdmin",
      "msg": "Only Admin"
    },
    {
      "code": 6001,
      "name": "maxRollbackSizeExceeded",
      "msg": "Maximum rollback data size exceeded"
    },
    {
      "code": 6002,
      "name": "invalidSn",
      "msg": "Invalid SN"
    },
    {
      "code": 6003,
      "name": "rollbackNotEnabled",
      "msg": "Rollback not enabled"
    },
    {
      "code": 6004,
      "name": "maxDataSizeExceeded",
      "msg": "Maximum data size exceeded"
    },
    {
      "code": 6005,
      "name": "rollbackAccountNotSpecified",
      "msg": "Rollback account is not specified"
    },
    {
      "code": 6006,
      "name": "rollbackCreatorNotSpecified",
      "msg": "Rollback account creator not specified"
    },
    {
      "code": 6007,
      "name": "pendingRequestAccountNotSpecified",
      "msg": "Pending request account is not specified"
    },
    {
      "code": 6008,
      "name": "pendingRequestCreatorNotSpecified",
      "msg": "Pending request account creator is not specified"
    },
    {
      "code": 6009,
      "name": "pendingResponseAccountNotSpecified",
      "msg": "Pending response account is not specified"
    },
    {
      "code": 6010,
      "name": "pendingResponseCreatorNotSpecified",
      "msg": "Pending response account creator is not specified"
    },
    {
      "code": 6011,
      "name": "invalidMessageSeed",
      "msg": "Invalid message seed"
    },
    {
      "code": 6012,
      "name": "successfulResponseAccountNotSpecified",
      "msg": "Successful response account is not specified"
    },
    {
      "code": 6013,
      "name": "protocolMismatch",
      "msg": "Protocol mismatch"
    },
    {
      "code": 6014,
      "name": "rollbackNotPossible",
      "msg": "Rollback not possible"
    },
    {
      "code": 6015,
      "name": "callRequestNotFound",
      "msg": "Call request not found"
    },
    {
      "code": 6016,
      "name": "noRollbackData",
      "msg": "No rollback data"
    },
    {
      "code": 6017,
      "name": "invalidReplyReceived",
      "msg": "Invalid reply received"
    },
    {
      "code": 6018,
      "name": "invalidMessageSequence",
      "msg": "Invalid message sequence received"
    },
    {
      "code": 6019,
      "name": "decodeFailed",
      "msg": "Decode failed"
    },
    {
      "code": 6020,
      "name": "invalidSource",
      "msg": "Invalid source"
    },
    {
      "code": 6021,
      "name": "invalidRequestId",
      "msg": "Invalid request id"
    },
    {
      "code": 6022,
      "name": "dataMismatch",
      "msg": "Data mismatch"
    },
    {
      "code": 6023,
      "name": "invalidPubkey",
      "msg": "Invalid pubkey"
    },
    {
      "code": 6024,
      "name": "parsePubkeyError",
      "msg": "Invalid source address"
    }
  ],
  "types": [
    {
      "name": "csMessageDecoded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "messageType",
            "type": {
              "defined": {
                "name": "csMessageType"
              }
            }
          },
          {
            "name": "request",
            "type": {
              "option": {
                "defined": {
                  "name": "csMessageRequest"
                }
              }
            }
          },
          {
            "name": "result",
            "type": {
              "option": {
                "defined": {
                  "name": "csMessageResult"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "csMessageRequest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "type": {
              "defined": {
                "name": "networkAddress"
              }
            }
          },
          {
            "name": "to",
            "type": "string"
          },
          {
            "name": "sequenceNo",
            "type": "u128"
          },
          {
            "name": "msgType",
            "type": {
              "defined": {
                "name": "messageType"
              }
            }
          },
          {
            "name": "data",
            "type": "bytes"
          },
          {
            "name": "protocols",
            "type": {
              "vec": "string"
            }
          }
        ]
      }
    },
    {
      "name": "csMessageResult",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sequenceNo",
            "type": "u128"
          },
          {
            "name": "responseCode",
            "type": {
              "defined": {
                "name": "csResponseType"
              }
            }
          },
          {
            "name": "message",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "csMessageType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "csMessageRequest"
          },
          {
            "name": "csMessageResult"
          }
        ]
      }
    },
    {
      "name": "csResponseType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "csResponseFailure"
          },
          {
            "name": "csResponseSuccess"
          }
        ]
      }
    },
    {
      "name": "callExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "reqId",
            "type": "u128"
          },
          {
            "name": "code",
            "type": "u8"
          },
          {
            "name": "msg",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "callMessage",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "type": "string"
          },
          {
            "name": "to",
            "type": "string"
          },
          {
            "name": "sn",
            "type": "u128"
          },
          {
            "name": "reqId",
            "type": "u128"
          },
          {
            "name": "data",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "callMessageSent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "string"
          },
          {
            "name": "sn",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "feeHandler",
            "type": "pubkey"
          },
          {
            "name": "networkId",
            "type": "string"
          },
          {
            "name": "protocolFee",
            "type": "u64"
          },
          {
            "name": "sequenceNo",
            "type": "u128"
          },
          {
            "name": "lastReqId",
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
      "name": "defaultConnection",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "messageType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "callMessage"
          },
          {
            "name": "callMessageWithRollback"
          },
          {
            "name": "callMessagePersisted"
          }
        ]
      }
    },
    {
      "name": "networkAddress",
      "type": {
        "kind": "struct",
        "fields": [
          "string"
        ]
      }
    },
    {
      "name": "pendingRequest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sources",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "pendingResponse",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sources",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "proxyRequest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "req",
            "type": {
              "defined": {
                "name": "csMessageRequest"
              }
            }
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "reply",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "replyState",
            "type": {
              "option": {
                "defined": {
                  "name": "csMessageRequest"
                }
              }
            }
          },
          {
            "name": "callReply",
            "type": {
              "option": {
                "defined": {
                  "name": "csMessageRequest"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "responseMessage",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "code",
            "type": "u8"
          },
          {
            "name": "sn",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "rollback",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": {
              "defined": {
                "name": "networkAddress"
              }
            }
          },
          {
            "name": "enabled",
            "type": "bool"
          },
          {
            "name": "rollback",
            "type": "bytes"
          },
          {
            "name": "protocols",
            "type": {
              "vec": "string"
            }
          }
        ]
      }
    },
    {
      "name": "rollbackAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rollback",
            "type": {
              "defined": {
                "name": "rollback"
              }
            }
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "rollbackExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sn",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "rollbackMessage",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sn",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "successfulResponse",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "success",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
