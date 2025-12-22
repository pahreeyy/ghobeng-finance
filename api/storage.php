<?php
require __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// Wajib sudah login
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Belum login']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $key = $_GET['key'] ?? '';
    if ($key === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Key wajib diisi']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT value FROM storage WHERE `key` = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetchColumn();

    if ($row === false || $row === null || $row === '') {
        echo '[]';
    } else {
        echo $row;
    }
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);

    $key  = $input['key']  ?? '';
    $data = $input['data'] ?? null;

    if ($key === '' || $data === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Key dan data wajib diisi']);
        exit;
    }

    $json = json_encode($data);

    $stmt = $pdo->prepare(
        'INSERT INTO storage (`key`, `value`) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');

    $stmt->execute([$key, $json]);

    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method tidak didukung']);
