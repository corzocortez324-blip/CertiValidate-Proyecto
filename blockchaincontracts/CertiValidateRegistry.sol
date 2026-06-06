// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertiValidateRegistry
 * @notice Registro inmutable de hashes SHA-256 de certificados académicos en Polygon Amoy.
 * @dev No almacena datos personales ni PDFs. Solo hashes, timestamps y emisores.
 *      Compatible con ethers.js v6 y optimizado para bajo consumo de gas.
 * @custom:network Polygon Amoy (testnet) / Polygon PoS (mainnet)
 */
contract CertiValidateRegistry {

    // ─── Structs ────────────────────────────────────────────────────────────────

    /**
     * @notice Registro de un certificado académico.
     * @dev El hash es la key del mapping; no se almacena de nuevo dentro del struct.
     *      Empaquetado en 2 slots de storage:
     *        Slot 0 → uint256 registeredAt  (32 bytes)
     *        Slot 1 → address issuer (20 b) + bool exists (1 b)  ← packed
     * @param registeredAt Timestamp Unix del momento de registro.
     * @param issuer       Dirección de la institución emisora.
     * @param exists       Flag de existencia para distinguir el zero-value del mapping.
     */
    struct CertificateRecord {
        uint256 registeredAt;
        address issuer;
        bool    exists;
    }

    // ─── Storage ────────────────────────────────────────────────────────────────

    /// @dev Mapeo principal: hash SHA-256 → registro. Acceso O(1), sin iteraciones.
    mapping(bytes32 => CertificateRecord) private _records;

    /// @dev Propietario inmutable del contrato. `immutable` evita SLOAD en cada acceso.
    address public immutable owner;

    /// @dev Emisores habilitados para registrar certificados.
    mapping(address => bool) public authorizedIssuers;

    // ─── Events ─────────────────────────────────────────────────────────────────

    /**
     * @notice Emitido al registrar un nuevo certificado.
     * @param certificateHash Hash SHA-256 del certificado.
     * @param issuer          Dirección del emisor.
     * @param registeredAt    Timestamp del registro.
     */
    event CertificateRegistered(
        bytes32 indexed certificateHash,
        address indexed issuer,
        uint256         registeredAt
    );

    /**
     * @notice Emitido por verifyAndEmit para trazabilidad on-chain de verificaciones.
     * @dev    No es emitido por verifyCertificate (view) ni por getCertificate (view).
     * @param certificateHash Hash del certificado verificado.
     * @param issuer          Dirección del emisor original.
     * @param registeredAt    Timestamp del registro original.
     * @param verifiedAt      Timestamp de esta verificación.
     */
    event CertificateVerified(
        bytes32 indexed certificateHash,
        address indexed issuer,
        uint256         registeredAt,
        uint256         verifiedAt
    );

    /**
     * @notice Emitido al autorizar o revocar un emisor.
     * @param issuer      Dirección afectada.
     * @param authorized  true = autorizado, false = revocado.
     */
    event IssuerUpdated(address indexed issuer, bool authorized);

    // ─── Modifiers ───────────────────────────────────────────────────────────────

    /// @dev Restringe al propietario del contrato.
    modifier onlyOwner() {
        require(msg.sender == owner, "CertiValidate: caller is not the owner");
        _;
    }

    /**
     * @dev Restringe a emisores autorizados.
     *      El owner conserva acceso aunque se auto-revoque del mapping,
     *      evitando un bloqueo permanente del contrato.
     */
    modifier onlyAuthorized() {
        require(
            authorizedIssuers[msg.sender] || msg.sender == owner,
            "CertiValidate: caller is not an authorized issuer"
        );
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────────

    /**
     * @notice Despliega el contrato. El deployer queda como owner y primer emisor autorizado.
     */
    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerUpdated(msg.sender, true);
    }

    // ─── Write Functions ─────────────────────────────────────────────────────────

    /**
     * @notice Registra el hash SHA-256 de un certificado académico en la blockchain.
     * @dev    Solo emisores autorizados. Rechaza duplicados y el hash cero.
     * @param  hash Hash SHA-256 del certificado (bytes32, 32 bytes).
     */
    function registerCertificate(bytes32 hash) external onlyAuthorized {
        require(hash != bytes32(0), "CertiValidate: hash cannot be zero");
        require(!_records[hash].exists, "CertiValidate: certificate already registered");

        uint256 ts = block.timestamp;
        _records[hash] = CertificateRecord({ registeredAt: ts, issuer: msg.sender, exists: true });

        emit CertificateRegistered(hash, msg.sender, ts);
    }

    /**
     * @notice Registra on-chain el evento de verificación de un certificado (auditoría).
     * @dev    Consume gas (escribe en el log). Úsalo cuando necesites trazabilidad on-chain.
     *         Para verificaciones gratuitas usa verifyCertificate (view).
     * @param  hash Hash SHA-256 a verificar.
     * @return valid        true si el certificado está registrado.
     * @return issuer       Dirección del emisor original.
     * @return registeredAt Timestamp del registro original.
     */
    function verifyAndEmit(bytes32 hash)
        external
        returns (bool valid, address issuer, uint256 registeredAt)
    {
        require(hash != bytes32(0), "CertiValidate: hash cannot be zero");

        CertificateRecord storage r = _records[hash];
        (valid, issuer, registeredAt) = (r.exists, r.issuer, r.registeredAt);

        if (valid) {
            emit CertificateVerified(hash, issuer, registeredAt, block.timestamp);
        }
    }

    /**
     * @notice Autoriza o revoca a una dirección como emisor de certificados.
     * @dev    Solo el owner puede modificar la lista.
     * @param  issuer      Dirección a configurar.
     * @param  authorized  true = autorizar, false = revocar.
     */
    function setIssuer(address issuer, bool authorized) external onlyOwner {
        require(issuer != address(0), "CertiValidate: issuer cannot be zero address");
        authorizedIssuers[issuer] = authorized;
        emit IssuerUpdated(issuer, authorized);
    }

    // ─── View Functions (sin costo de gas para llamadas externas) ────────────────

    /**
     * @notice Verifica si un hash existe en el registro. Gratuito desde fuera de la blockchain.
     * @dev    Función view: no modifica estado, no emite eventos, no consume gas en llamadas
     *         off-chain (eth_call). Compatible con ethers.js v6: contract.verifyCertificate(hash).
     * @param  hash Hash SHA-256 a verificar.
     * @return valid        true si el certificado está registrado.
     * @return issuer       Dirección del emisor original.
     * @return registeredAt Timestamp del registro original.
     */
    function verifyCertificate(bytes32 hash)
        external
        view
        returns (bool valid, address issuer, uint256 registeredAt)
    {
        require(hash != bytes32(0), "CertiValidate: hash cannot be zero");
        CertificateRecord storage r = _records[hash];
        return (r.exists, r.issuer, r.registeredAt);
    }

    /**
     * @notice Retorna los campos del registro de un certificado dado su hash.
     * @dev    Función view: gratuita en llamadas off-chain.
     * @param  hash Hash SHA-256 del certificado.
     * @return registeredAt Timestamp del registro.
     * @return issuer       Dirección del emisor.
     * @return exists       true si el certificado está registrado.
     */
    function getCertificate(bytes32 hash)
        external
        view
        returns (uint256 registeredAt, address issuer, bool exists)
    {
        require(hash != bytes32(0), "CertiValidate: hash cannot be zero");
        CertificateRecord storage r = _records[hash];
        return (r.registeredAt, r.issuer, r.exists);
    }

    /**
     * @notice Check rápido de existencia. Útil cuando solo se necesita el boolean.
     * @param  hash Hash SHA-256 a consultar.
     * @return bool true si el certificado está registrado.
     */
    function certificateExists(bytes32 hash) external view returns (bool) {
        return _records[hash].exists;
    }
}
