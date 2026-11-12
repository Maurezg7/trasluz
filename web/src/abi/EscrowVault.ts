// Generado por contracts/scripts/export-abi.ts — no editar
export const EscrowVaultAbi = [
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
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "SoloManager",
    "type": "error"
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
    "inputs": [],
    "name": "manager",
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
    "inputs": [
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
        "name": "proof",
        "type": "tuple"
      }
    ],
    "name": "registrarClave",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
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
    "name": "transferir",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
