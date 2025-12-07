<?php
require __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'manager') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Hanya manager yang boleh mengelola user.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? 'list';
    if ($action === 'list') {
        $stmt = $pdo->query('SELECT id, username, role, created_at FROM users ORDER BY id ASC');
        $users = $stmt->fetchAll() ?: [];
        echo json_encode(['success' => true, 'users' => $users]);
        exit;
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Aksi tidak dikenal.']);
    exit;
}

if ($method === 'POST') {
    $inputRaw = file_get_contents('php://input');
    $input = json_decode($inputRaw, true);

    $action = $input['action'] ?? 'create';

    if ($action === 'create') {
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';
        $role     = $input['role'] ?? 'mechanic';

        if ($username === '' || $password === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Username dan password wajib diisi.']);
            exit;
        }
        if (!in_array($role, ['manager','mechanic'], true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Role tidak valid.']);
            exit;
        }

        try {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)');
            $stmt->execute([$username, $hash, $role]);
            echo json_encode(['success' => true, 'message' => 'User baru berhasil dibuat.']);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Username sudah dipakai.']);
                exit;
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error database saat membuat user.']);
        }
        exit;
    }

    if ($action === 'delete') {
        $id = (int)($input['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID user tidak valid.']);
            exit;
        }

        if ($id === (int)$_SESSION['user_id']) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Tidak bisa menghapus akun yang sedang login.']);
            exit;
        }

        $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'User berhasil dihapus.']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Aksi tidak dikenal.']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method tidak didukung.']);
