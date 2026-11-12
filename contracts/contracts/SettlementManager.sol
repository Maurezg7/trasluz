// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {EncryptedERC} from "./vendor/eerc/EncryptedERC.sol";
import {Registrar} from "./vendor/eerc/Registrar.sol";
import {RegisterProof, TransferProof, AmountPCT} from "./vendor/eerc/types/Types.sol";

import {EscrowVault} from "./EscrowVault.sol";

/**
 * @title  SettlementManager — Trasluz
 * @notice Riel de liquidación B2B confidencial contra entrega, compuesto SOBRE el
 *         EncryptedERC oficial de Ava Labs (converter mode). No reimplementa ni toca
 *         la criptografía: cada obligación tiene su propio EscrowVault (cuenta eERC)
 *         y todos los movimientos de valor son `EncryptedERC.transfer` con prueba ZK.
 *
 *         Este contrato NUNCA conoce ni emite montos: no hay parámetro de monto en
 *         ninguna función, evento ni revert. Los montos viven cifrados en eERC y sólo
 *         el auditor designado (y las partes) pueden descifrarlos.
 *
 *  Máquina de estados:  Creada ──► Fondeada ──► Liberada
 *                          │           │
 *                          └───────────┴──► Cancelada   (sólo sin entrega confirmada)
 */
contract SettlementManager is Ownable2Step, ReentrancyGuard {
    using Clones for address;

    enum Estado {
        Inexistente,
        Creada,
        Fondeada,
        Liberada,
        Cancelada
    }

    struct Obligacion {
        address pagador;
        uint64 creadaEn;
        Estado estado;
        bool entregaConfirmada;
        address proveedor;
        uint64 actualizadaEn;
        address vault;
        bytes32 refFactura;
    }

    EncryptedERC public immutable eerc;
    Registrar public immutable registrar;
    /// @notice ERC-20 subyacente (USDC) envuelto por el eERC en converter mode.
    address public immutable token;
    address public immutable vaultImplementation;

    /// @notice Allowlist KYC: sólo entidades habilitadas pueden operar.
    mapping(address entidad => bool) public habilitada;
    mapping(address pagador => uint256) public nonces;
    mapping(address vault => uint256 id) public obligacionDeVault;
    uint256 public totalObligaciones;

    mapping(uint256 id => Obligacion) private _obligaciones;
    /// @dev Clave del vault cifrada (Poseidon) para el proveedor → puede verificar el fondeo.
    mapping(uint256 id => uint256[7]) private _claveVaultParaProveedor;

    ///////////////////////////////////////////////////
    ///                    Events                   ///
    ///////////////////////////////////////////////////

    /// @dev Deliberadamente SIN monto.
    event ObligacionActualizada(
        uint256 indexed id,
        address indexed pagador,
        address indexed proveedor,
        Estado estado,
        uint64 timestamp
    );
    event EntregaConfirmada(
        uint256 indexed id,
        address indexed pagador,
        address indexed proveedor,
        uint64 timestamp
    );
    event EntidadActualizada(address indexed entidad, bool habilitada, uint64 timestamp);

    ///////////////////////////////////////////////////
    ///                    Errors                   ///
    ///////////////////////////////////////////////////

    /// @dev Reverts genéricos: nunca incluyen montos ni datos sensibles.
    error NoHabilitada();
    error NoRegistradaEnEERC();
    error NoAutorizado();
    error EstadoInvalido();
    error SinFondos();
    error TokenNoInicializado();
    error ParametroInvalido();

    constructor(
        EncryptedERC eerc_,
        Registrar registrar_,
        address token_,
        address owner_
    ) Ownable(owner_) {
        if (address(eerc_) == address(0) || address(registrar_) == address(0) || token_ == address(0)) {
            revert ParametroInvalido();
        }
        eerc = eerc_;
        registrar = registrar_;
        token = token_;
        vaultImplementation = address(new EscrowVault(eerc_, registrar_));
    }

    ///////////////////////////////////////////////////
    ///                  Modifiers                  ///
    ///////////////////////////////////////////////////

    modifier soloHabilitada(address entidad) {
        if (!habilitada[entidad]) revert NoHabilitada();
        _;
    }

    modifier soloPagador(uint256 id) {
        if (_obligaciones[id].pagador != msg.sender) revert NoAutorizado();
        _;
    }

    ///////////////////////////////////////////////////
    ///              Allowlist (owner)              ///
    ///////////////////////////////////////////////////

    /// @notice En producción el owner es un multisig (Safe) detrás de un timelock.
    function setEntidad(address entidad, bool habilitar) external onlyOwner {
        if (entidad == address(0)) revert ParametroInvalido();
        habilitada[entidad] = habilitar;
        emit EntidadActualizada(entidad, habilitar, uint64(block.timestamp));
    }

    function setEntidades(address[] calldata entidades, bool habilitar) external onlyOwner {
        for (uint256 i; i < entidades.length; ++i) {
            if (entidades[i] == address(0)) revert ParametroInvalido();
            habilitada[entidades[i]] = habilitar;
            emit EntidadActualizada(entidades[i], habilitar, uint64(block.timestamp));
        }
    }

    ///////////////////////////////////////////////////
    ///                  Obligaciones               ///
    ///////////////////////////////////////////////////

    /**
     * @notice Crea una obligación de pago y su vault de escrow.
     * @param proveedor        Entidad habilitada y registrada en eERC.
     * @param refFactura       Hash con salt de la factura off-chain.
     * @param vaultProof       Prueba de registro de la clave del vault, generada para
     *                         `predecirVault(msg.sender)`.
     * @param claveVaultParaProveedor Clave del vault cifrada (Poseidon) con la clave pública
     *                         eERC del proveedor, para que verifique el fondeo.
     */
    function crear(
        address proveedor,
        bytes32 refFactura,
        RegisterProof calldata vaultProof,
        uint256[7] calldata claveVaultParaProveedor
    ) external soloHabilitada(msg.sender) soloHabilitada(proveedor) returns (uint256 id) {
        if (proveedor == msg.sender || refFactura == bytes32(0)) revert ParametroInvalido();
        if (!registrar.isUserRegistered(msg.sender) || !registrar.isUserRegistered(proveedor)) {
            revert NoRegistradaEnEERC();
        }

        address vault = vaultImplementation.cloneDeterministic(_salt(msg.sender, nonces[msg.sender]++));

        id = ++totalObligaciones;
        _obligaciones[id] = Obligacion({
            pagador: msg.sender,
            creadaEn: uint64(block.timestamp),
            estado: Estado.Creada,
            entregaConfirmada: false,
            proveedor: proveedor,
            actualizadaEn: uint64(block.timestamp),
            vault: vault,
            refFactura: refFactura
        });
        obligacionDeVault[vault] = id;
        _claveVaultParaProveedor[id] = claveVaultParaProveedor;

        // El Registrar oficial verifica la prueba y que la cuenta de la prueba == vault.
        EscrowVault(vault).registrarClave(vaultProof);

        _emitEstado(id);
    }

    /**
     * @notice Marca la obligación como fondeada. El pagador ya hizo `EncryptedERC.transfer`
     *         confidencial hacia el vault (monto oculto). Acá sólo se verifica que el
     *         vault haya recibido al menos una transferencia cifrada.
     */
    function fondear(uint256 id) external soloPagador(id) {
        Obligacion storage o = _obligaciones[id];
        if (o.estado != Estado.Creada) revert EstadoInvalido();
        (, , AmountPCT[] memory pcts, , ) = eerc.balanceOf(o.vault, _tokenId());
        if (pcts.length == 0) revert SinFondos();

        o.estado = Estado.Fondeada;
        o.actualizadaEn = uint64(block.timestamp);
        _emitEstado(id);
    }

    /// @notice El proveedor confirma la entrega. Bloquea la cancelación.
    function confirmarEntrega(uint256 id) external {
        Obligacion storage o = _obligaciones[id];
        if (o.proveedor != msg.sender) revert NoAutorizado();
        if (o.estado != Estado.Fondeada || o.entregaConfirmada) revert EstadoInvalido();

        o.entregaConfirmada = true;
        o.actualizadaEn = uint64(block.timestamp);
        emit EntregaConfirmada(id, o.pagador, o.proveedor, uint64(block.timestamp));
    }

    /**
     * @notice Libera el escrow al proveedor con una transferencia confidencial eERC.
     * @dev    Checks-effects-interactions: se marca Liberada ANTES de la llamada externa,
     *         más nonReentrant. El destinatario lo fija este contrato (no el caller), y
     *         EncryptedERC valida que la prueba esté hecha para la clave del proveedor.
     */
    function liberar(
        uint256 id,
        TransferProof calldata proof,
        uint256[7] calldata balancePCT
    ) external nonReentrant soloPagador(id) {
        Obligacion storage o = _obligaciones[id];
        if (o.estado != Estado.Fondeada || !o.entregaConfirmada) revert EstadoInvalido();
        if (!habilitada[o.proveedor]) revert NoHabilitada();

        o.estado = Estado.Liberada;
        o.actualizadaEn = uint64(block.timestamp);
        _emitEstado(id);

        EscrowVault(o.vault).transferir(o.proveedor, _tokenId(), proof, balancePCT);
    }

    /// @notice Cancela si todavía no hubo entrega confirmada.
    function cancelar(uint256 id) external soloPagador(id) {
        Obligacion storage o = _obligaciones[id];
        if (o.estado == Estado.Fondeada) {
            if (o.entregaConfirmada) revert EstadoInvalido();
        } else if (o.estado != Estado.Creada) {
            revert EstadoInvalido();
        }

        o.estado = Estado.Cancelada;
        o.actualizadaEn = uint64(block.timestamp);
        _emitEstado(id);
    }

    /// @notice Devuelve al pagador lo que quede en el vault (cancelada o remanente post-liberación).
    function reembolsar(
        uint256 id,
        TransferProof calldata proof,
        uint256[7] calldata balancePCT
    ) external nonReentrant soloPagador(id) {
        Obligacion storage o = _obligaciones[id];
        if (o.estado != Estado.Cancelada && o.estado != Estado.Liberada) revert EstadoInvalido();
        EscrowVault(o.vault).transferir(o.pagador, _tokenId(), proof, balancePCT);
    }

    ///////////////////////////////////////////////////
    ///                     Views                   ///
    ///////////////////////////////////////////////////

    function obligacion(uint256 id) external view returns (Obligacion memory) {
        return _obligaciones[id];
    }

    function claveVaultCifrada(uint256 id) external view returns (uint256[7] memory) {
        return _claveVaultParaProveedor[id];
    }

    /// @notice Dirección del próximo vault de `pagador` (para generar la prueba de registro).
    function predecirVault(address pagador) external view returns (address) {
        return vaultImplementation.predictDeterministicAddress(_salt(pagador, nonces[pagador]));
    }

    function tokenId() external view returns (uint256) {
        return eerc.tokenIds(token);
    }

    ///////////////////////////////////////////////////
    ///                   Internal                  ///
    ///////////////////////////////////////////////////

    function _tokenId() internal view returns (uint256 id) {
        id = eerc.tokenIds(token);
        if (id == 0) revert TokenNoInicializado();
    }

    function _salt(address pagador, uint256 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encode(pagador, nonce));
    }

    function _emitEstado(uint256 id) internal {
        Obligacion storage o = _obligaciones[id];
        emit ObligacionActualizada(id, o.pagador, o.proveedor, o.estado, uint64(block.timestamp));
    }
}
