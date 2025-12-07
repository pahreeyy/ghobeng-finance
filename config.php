<?php
// Konfigurasi koneksi database
$host = 'localhost';
$db   = 'ghobeng_finance'; // ganti kalau nama database kamu beda
$user = 'root';            // ganti kalau user MySQL kamu beda
$pass = '';                // ganti kalau pakai password

$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    http_response_code(500);
    echo "Koneksi database gagal.";
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
