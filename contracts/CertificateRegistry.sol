// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CertificateRegistry
 * @notice Sistem notaris digital untuk sertifikat akademik berbasis blockchain.
 *         Hanya menyimpan hash keccak256 dari file PDF, bukan file aslinya.
 * @dev Menggunakan pendekatan proof-of-existence. Hash dihitung di luar contract
 *      (di frontend/backend) lalu disimpan di sini sebagai bukti keaslian.
 */
contract CertificateRegistry is Ownable {
    // =========================================================================
    // Types
    // =========================================================================

    /// @notice Status sertifikat yang dapat berubah
    enum Status {
        Active,   // 0 — sertifikat aktif dan valid
        Revoked,  // 1 — sertifikat dicabut (tidak valid)
        Updated   // 2 — sertifikat diperbarui (merujuk ke versi baru)
    }

    /// @notice Data utama sebuah sertifikat
    struct Certificate {
        bool exists;      // guard anti-duplikasi
        string label;     // nama/deskripsi sertifikat
        uint256 issuedAt; // timestamp penerbitan (block.timestamp)
        address issuer;   // alamat wallet admin yang menerbitkan
        Status status;    // status saat ini
    }

    /// @notice Satu entri riwayat perubahan status
    struct StatusHistory {
        Status status;      // status baru yang diterapkan
        uint256 changedAt;  // timestamp perubahan (block.timestamp)
        address changedBy;  // alamat wallet yang melakukan perubahan
        string reason;      // alasan perubahan (opsional, boleh string kosong)
    }

    // =========================================================================
    // Storage
    // =========================================================================

    /// @notice Penyimpanan data sertifikat, key = keccak256 hash dari file PDF
    mapping(bytes32 => Certificate) private _certificates;

    /// @notice Riwayat perubahan status per sertifikat (append-only)
    mapping(bytes32 => StatusHistory[]) private _statusHistories;

    // =========================================================================
    // Events
    // =========================================================================

    /**
     * @notice Dipancarkan saat sertifikat baru diterbitkan
     * @param hash    keccak256 hash dari file PDF sertifikat
     * @param label   nama/deskripsi sertifikat
     * @param issuer  alamat admin yang menerbitkan
     * @param issuedAt timestamp penerbitan
     */
    event CertificateIssued(
        bytes32 indexed hash,
        string label,
        address indexed issuer,
        uint256 issuedAt
    );

    /**
     * @notice Dipancarkan saat status sertifikat diperbarui
     * @param hash       keccak256 hash sertifikat yang diubah
     * @param newStatus  status baru (Active/Revoked/Updated)
     * @param updatedBy  alamat admin yang melakukan perubahan
     * @param reason     alasan perubahan
     */
    event StatusUpdated(
        bytes32 indexed hash,
        Status newStatus,
        address indexed updatedBy,
        string reason
    );

    // =========================================================================
    // Errors
    // =========================================================================

    error CertificateAlreadyExists(bytes32 hash);
    error CertificateNotFound(bytes32 hash);
    error InvalidHash();
    error LabelCannotBeEmpty();
    error StatusUnchanged(bytes32 hash, Status currentStatus);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor() Ownable(msg.sender) {}

    // =========================================================================
    // Write Functions (onlyOwner)
    // =========================================================================

    /**
     * @notice Menerbitkan sertifikat baru dengan menyimpan hash-nya on-chain.
     * @dev Hash harus unik — satu hash tidak dapat diterbitkan lebih dari sekali.
     *      Hash dihitung di luar contract: keccak256(file PDF bytes).
     * @param hash  keccak256 hash dari file PDF sertifikat (bytes32)
     * @param label nama/deskripsi sertifikat (misal: "Sertifikat Kelulusan 2025")
     */
    function issueCertificate(
        bytes32 hash,
        string calldata label
    ) external onlyOwner {
        if (hash == bytes32(0)) revert InvalidHash();
        if (bytes(label).length == 0) revert LabelCannotBeEmpty();
        if (_certificates[hash].exists) revert CertificateAlreadyExists(hash);

        _certificates[hash] = Certificate({
            exists: true,
            label: label,
            issuedAt: block.timestamp,
            issuer: msg.sender,
            status: Status.Active
        });

        emit CertificateIssued(hash, label, msg.sender, block.timestamp);
    }

    /**
     * @notice Memperbarui status sertifikat dan menyimpan riwayat perubahan.
     * @dev Setiap update status dicatat di _statusHistories[hash] secara permanen.
     *      Sertifikat tidak dapat dihapus — hanya status yang bisa diubah.
     * @param hash       keccak256 hash sertifikat yang akan diubah statusnya
     * @param newStatus  status baru: Active (0), Revoked (1), atau Updated (2)
     * @param reason     alasan perubahan status (boleh string kosong)
     */
    function updateStatus(
        bytes32 hash,
        Status newStatus,
        string calldata reason
    ) external onlyOwner {
        if (!_certificates[hash].exists) revert CertificateNotFound(hash);
        if (_certificates[hash].status == newStatus)
            revert StatusUnchanged(hash, newStatus);

        _certificates[hash].status = newStatus;

        _statusHistories[hash].push(
            StatusHistory({
                status: newStatus,
                changedAt: block.timestamp,
                changedBy: msg.sender,
                reason: reason
            })
        );

        emit StatusUpdated(hash, newStatus, msg.sender, reason);
    }

    // =========================================================================
    // Read Functions (view — 0 gas saat dipanggil off-chain)
    // =========================================================================

    /**
     * @notice Mengambil seluruh data sertifikat berdasarkan hash.
     * @param hash  keccak256 hash sertifikat
     * @return exists    true jika sertifikat terdaftar
     * @return label     nama/deskripsi sertifikat
     * @return issuedAt  timestamp penerbitan
     * @return issuer    alamat admin penerbit
     * @return status    status saat ini (0=Active, 1=Revoked, 2=Updated)
     */
    function getCertificate(
        bytes32 hash
    )
        external
        view
        returns (
            bool exists,
            string memory label,
            uint256 issuedAt,
            address issuer,
            Status status
        )
    {
        Certificate storage cert = _certificates[hash];
        return (
            cert.exists,
            cert.label,
            cert.issuedAt,
            cert.issuer,
            cert.status
        );
    }

    /**
     * @notice Mengambil seluruh riwayat perubahan status sertifikat.
     * @param hash  keccak256 hash sertifikat
     * @return array StatusHistory yang berisi semua perubahan status
     */
    function getHistory(
        bytes32 hash
    ) external view returns (StatusHistory[] memory) {
        return _statusHistories[hash];
    }

    /**
     * @notice Memverifikasi apakah sertifikat terdaftar dan masih aktif.
     * @dev Ini adalah fungsi utama untuk QR code verifikasi — memanggil ini
     *      tidak membutuhkan gas sama sekali (view function, off-chain call).
     * @param hash  keccak256 hash sertifikat
     * @return true jika sertifikat ada dan berstatus Active
     */
    function isValid(bytes32 hash) external view returns (bool) {
        Certificate storage cert = _certificates[hash];
        return cert.exists && cert.status == Status.Active;
    }

    /**
     * @notice Mengembalikan jumlah entri riwayat status sertifikat.
     * @param hash  keccak256 hash sertifikat
     * @return jumlah perubahan status yang pernah terjadi
     */
    function getHistoryCount(bytes32 hash) external view returns (uint256) {
        return _statusHistories[hash].length;
    }
}
