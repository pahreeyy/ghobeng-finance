Ghobeng Finance - versi multi-user dengan manajemen user
===========================================================

1. Import database
------------------
- Buka phpMyAdmin (http://localhost/phpmyadmin)
- Buat database dengan nama: ghobeng_finance
- Import file: sql/schema.sql

2. Sesuaikan koneksi database
-----------------------------
- Buka config.php
- Sesuaikan:
    $host, $db, $user, $pass
  dengan setting MySQL / XAMPP kamu.

3. Buat user default
--------------------
- Pastikan Apache & MySQL sudah jalan di XAMPP.
- Copy folder ini ke:
    C:\xampp\htdocs\ghobeng-finance
- Buka di browser:
    http://localhost/ghobeng-finance/create_default_users.php
- Kalau muncul tulisan "OK - user manager/mekanik sudah dibuat",
  hapus file create_default_users.php (opsional tapi disarankan).

User default:
- manager / manager123  (role: manager)
- mekanik / mekanik123  (role: mechanic)

4. Jalankan aplikasi
--------------------
- Buka:
    http://localhost/ghobeng-finance/index.html
- Login dengan salah satu user di atas.
- Semua data (transaksi, mekanik, stok) disimpan di database lewat API PHP
  (api/storage.php), bukan lagi di localStorage browser.

5. Manajemen user
-----------------
- Login sebagai user dengan role "manager".
- Buka menu "Manajemen User" di sidebar.
- Di sana kamu bisa menambah user baru (username, password, role)
  dan menghapus user yang tidak dipakai.
- API yang dipakai: api/users.php (hanya bisa diakses oleh manager).

