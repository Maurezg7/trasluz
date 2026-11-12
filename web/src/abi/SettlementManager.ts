// Generado por contracts/scripts/export-abi.ts — no editar
export const SettlementManagerAbi = [
  {
    "inputs": [
      {
        "internalType": "contract EncryptedERC",
        "name": "eerc_",
        "type": "address"
      },
      {
        "internalType": "contract Registrar",
        "name": "registrar_",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "token_",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "owner_",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "EstadoInvalido",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FailedDeployment",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "balance",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "needed",
        "type": "uint256"
      }
    ],
    "name": "InsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoAutorizado",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoHabilitada",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoRegistradaEnEERC",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ParametroInvalido",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SinFondos",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TokenNoInicializado",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "entidad",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "habilitada",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "timestamp",
        "type": "uint64"
      }
    ],
    "name": "EntidadActualizada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "pagador",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "proveedor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "timestamp",
        "type": "uint64"
      }
    ],
    "name": "EntregaConfirmada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "pagador",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "proveedor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "enum SettlementManager.Estado",
        "name": "estado",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "timestamp",
        "type": "uint64"
      }
    ],
    "name": "ObligacionActualizada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "acceptOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "cancelar",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "claveVaultCifrada",
    "outputs": [
      {
        "internalType": "uint256[7]",
        "name": "",
        "type": "uint256[7]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "confirmarEntrega",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "proveedor",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "refFactura",
        "type": "bytes32"
      },
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256[2]",
                "name": "a",
                "type": "uint256[2]"
              },
              {
                "internalType": "uint256[2][2]",
                "name": "b",
                "type": "uint256[2][2]"
              },
              {
                "internalType": "uint256[2]",
                "name": "c",
                "type": "uint256[2]"
              }
            ],
            "internalType": "struct ProofPoints",
            "name": "proofPoints",
            "type": "tuple"
          },
          {
            "internalType": "uint256[5]",
            "name": "publicSignals",
            "type": "uint256[5]"
          }
        ],
        "internalType": "struct RegisterProof",
        "name": "vaultProof",
        "type": "tuple"
      },
      {
        "internalType": "uint256[7]",
        "name": "claveVaultParaProveedor",
        "type": "uint256[7]"
      }
    ],
    "name": "crear",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "eerc",
    "outputs": [
      {
        "internalType": "contract EncryptedERC",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "fondear",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "entidad",
        "type": "address"
      }
    ],
    "name": "habilitada",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256[2]",
                "name": "a",
                "type": "uint256[2]"
              },
              {
                "internalType": "uint256[2][2]",
                "name": "b",
                "type": "uint256[2][2]"
              },
              {
                "internalType": "uint256[2]",
                "name": "c",
                "type": "uint256[2]"
              }
            ],
            "internalType": "struct ProofPoints",
            "name": "proofPoints",
            "type": "tuple"
          },
          {
            "internalType": "uint256[32]",
            "name": "publicSignals",
            "type": "uint256[32]"
          }
        ],
        "internalType": "struct TransferProof",
        "name": "proof",
        "type": "tuple"
      },
      {
        "internalType": "uint256[7]",
        "name": "balancePCT",
        "type": "uint256[7]"
      }
    ],
    "name": "liberar",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pagador",
        "type": "address"
      }
    ],
    "name": "nonces",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "obligacion",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "pagador",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "creadaEn",
            "type": "uint64"
          },
          {
            "internalType": "enum SettlementManager.Estado",
            "name": "estado",
            "type": "uint8"
          },
          {
            "internalType": "bool",
            "name": "entregaConfirmada",
            "type": "bool"
          },
          {
            "internalType": "address",
            "name": "proveedor",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "actualizadaEn",
            "type": "uint64"
          },
          {
            "internalType": "address",
            "name": "vault",
            "type": "address"
          },
          {
            "internalType": "bytes32",
            "name": "refFactura",
            "type": "bytes32"
          }
        ],
        "internalType": "struct SettlementManager.Obligacion",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "vault",
        "type": "address"
      }
    ],
    "name": "obligacionDeVault",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pendingOwner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pagador",
        "type": "address"
      }
    ],
    "name": "predecirVault",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256[2]",
                "name": "a",
                "type": "uint256[2]"
              },
              {
                "internalType": "uint256[2][2]",
                "name": "b",
                "type": "uint256[2][2]"
              },
              {
                "internalType": "uint256[2]",
                "name": "c",
                "type": "uint256[2]"
              }
            ],
            "internalType": "struct ProofPoints",
            "name": "proofPoints",
            "type": "tuple"
          },
          {
            "internalType": "uint256[32]",
            "name": "publicSignals",
            "type": "uint256[32]"
          }
        ],
        "internalType": "struct TransferProof",
        "name": "proof",
        "type": "tuple"
      },
      {
        "internalType": "uint256[7]",
        "name": "balancePCT",
        "type": "uint256[7]"
      }
    ],
    "name": "reembolsar",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "registrar",
    "outputs": [
      {
        "internalType": "contract Registrar",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "entidad",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "habilitar",
        "type": "bool"
      }
    ],
    "name": "setEntidad",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "entidades",
        "type": "address[]"
      },
      {
        "internalType": "bool",
        "name": "habilitar",
        "type": "bool"
      }
    ],
    "name": "setEntidades",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalObligaciones",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "vaultImplementation",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
