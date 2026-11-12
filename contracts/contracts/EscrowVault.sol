// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EncryptedERC} from "./vendor/eerc/EncryptedERC.sol";
import {Registrar} from "./vendor/eerc/Registrar.sol";
import {RegisterProof, TransferProof} from "./vendor/eerc/types/Types.sol";

/**
 * @title EscrowVault
 * @notice Cuenta eERC de escrow para UNA obligación. Se despliega como clon EIP-1167
 *         por SettlementManager y se registra en el Registrar oficial con su propia
 *         clave BabyJubJub.
 * @dev    La clave BabyJubJub del vault sólo sirve para descifrar su saldo y generar
 *         pruebas; NO es autoridad de gasto. El único que puede mover fondos es
 *         `manager` (SettlementManager), que fija destinatario y estado.
 *         Las variables immutables viven en el bytecode de la implementación y los
 *         clones las heredan vía delegatecall.
 */
contract EscrowVault {
    address public immutable manager;
    EncryptedERC public immutable eerc;
    Registrar public immutable registrar;

    error SoloManager();

    constructor(EncryptedERC eerc_, Registrar registrar_) {
        manager = msg.sender;
        eerc = eerc_;
        registrar = registrar_;
    }

    modifier onlyManager() {
        if (msg.sender != manager) revert SoloManager();
        _;
    }

    /// @notice Registra la clave pública del vault. El Registrar exige msg.sender == cuenta de la prueba.
    function registrarClave(RegisterProof calldata proof) external onlyManager {
        registrar.register(proof);
    }

    /// @notice Transferencia confidencial desde el vault. Monto oculto en la prueba.
    function transferir(
        address to,
        uint256 tokenId,
        TransferProof calldata proof,
        uint256[7] calldata balancePCT
    ) external onlyManager {
        eerc.transfer(to, tokenId, proof, balancePCT);
    }
}
