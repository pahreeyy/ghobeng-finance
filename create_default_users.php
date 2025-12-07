<?php
// Jalankan file ini SEKALI saja untuk membuat user default.
// Setelah muncul tulisan OK di browser, hapus file ini demi keamanan.
require __DIR__ . '/config.php';

$managerPass = password_hash('manager123', PASSWORD_DEFAULT);
$mekanikPass = password_hash('mekanik123', PASSWORD_DEFAULT);

$pdo->prepare('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)')
    ->execute(['manager', $managerPass, 'manager']);

$pdo->prepare('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)')
    ->execute(['mekanik', $mekanikPass, 'mechanic']);

echo "OK - user manager/mekanik sudah dibuat";
