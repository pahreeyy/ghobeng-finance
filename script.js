    // ===== STORAGE KEYS =====
    const STORAGE_KEY_TRANSACTIONS = "garagebook_transactions_v1";
    const STORAGE_KEY_MECHANICS = "garagebook_mechanics_v1";
    const STORAGE_KEY_USER = "garagebook_current_user_v1";
    const STORAGE_KEY_STOCK = "garagebook_stock_v1"; // stok

    // ===== USER AUTH (SERVER) =====
    // User dan password sekarang dikelola di tabel `users` di database.
    // Login dilakukan via API (api/login.php), bukan lagi array USERS di frontend.

    let currentUser = null;

    // ===== PRICE LIST =====
    const CATEGORY_PRICE = {
      "Rep S": 2000,
      "Rep X": 2000,
      "Rep M": 2000,
      "Rep A": 2000,
      "Rep B": 2000,
      "Rep C": 2000,
      "Rep D": 2000,
      "Nitro": 8000,
      "Kanebo": 1000,
      "Tool S": 5000,
      "Tool X": 5000,
      "Tool M": 5000,
      "Tool A": 5000,
      "T Sport": 3500,
      "T SUV": 3500,
      "T Moto": 3500,
      "T Offroad": 3500
    };

    // ===== UTIL =====
    function loadTransactions() {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "api/storage.php?key=" + encodeURIComponent(STORAGE_KEY_TRANSACTIONS) + "&ts=" + Date.now(), false);
        xhr.send(null);
        if (xhr.status === 200 && xhr.responseText) {
          return JSON.parse(xhr.responseText);
        }
      } catch (e) {
        console.error(e);
      }
      return [];
    }

    function saveTransactions(list, opts) {
      opts = opts || {};
      try {
        // Default: merge dengan data terbaru di server supaya history tidak ketimpa (lebih aman untuk multi-user)
        let dataToSave = list;
        if (!opts.exact) {
          const remote = loadTransactions();
          dataToSave = mergeById(remote, list);
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "api/storage.php", false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({
          key: STORAGE_KEY_TRANSACTIONS,
          data: dataToSave
        }));
      } catch (e) {
        console.error(e);
      }
    }

    function loadMechanics() {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "api/storage.php?key=" + encodeURIComponent(STORAGE_KEY_MECHANICS) + "&ts=" + Date.now(), false);
        xhr.send(null);
        if (xhr.status === 200 && xhr.responseText) {
          return JSON.parse(xhr.responseText);
        }
      } catch (e) {
        console.error(e);
      }
      return [];
    }

    function saveMechanics(list) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "api/storage.php", false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({
          key: STORAGE_KEY_MECHANICS,
          data: list
        }));
      } catch (e) {
        console.error(e);
      }
    }

    // STOCK util
    function loadStockMovements() {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "api/storage.php?key=" + encodeURIComponent(STORAGE_KEY_STOCK) + "&ts=" + Date.now(), false);
        xhr.send(null);
        if (xhr.status === 200 && xhr.responseText) {
          return JSON.parse(xhr.responseText);
        }
      } catch (e) {
        console.error(e);
      }
      return [];
    }

    function saveStockMovements(list) {
      try {
        // Merge dengan data server (karena bisa ada input dari user lain)
        const remote = loadStockMovements();
        const dataToSave = mergeById(remote, list);

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "api/storage.php", false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({
          key: STORAGE_KEY_STOCK,
          data: dataToSave
        }));
      } catch (e) {
        console.error(e);
      }
    }

    function stockTotalsByCategory(stockMovements) {
      const rekap = {};
      stockMovements.forEach(m => {
        const cat = m.category || "-";
        if (!rekap[cat]) rekap[cat] = 0;
        const qty = Number(m.qty) || 0;
        if (m.direction === "in") rekap[cat] += qty;
        if (m.direction === "out") rekap[cat] -= qty;
      });

      Object.keys(CATEGORY_PRICE).forEach(cat => {
        if (rekap[cat] == null) rekap[cat] = 0;
      });

      return rekap;
    }

    function getStockRekap(){
      const movement = loadStockMovements();
      return stockTotalsByCategory(movement);
    }
    
    function formatCurrency(num) {
      const n = Number(num) || 0;
      return "IDP$ " + n.toLocaleString("id-ID");
    }


    // ===== MERGE UTIL (biar multi-user tidak saling ketimpa) =====
    // Gabungkan data server + data lokal berdasarkan id (yang terakhir menang).
    function mergeById(remoteList, localList) {
      const map = {};
      (remoteList || []).forEach(item => {
        if (item && item.id) map[item.id] = item;
      });
      (localList || []).forEach(item => {
        if (item && item.id) map[item.id] = item;
      });
      return Object.values(map);
    }

    // ===== LIVE SYNC (AUTO UPDATE TANPA REFRESH) =====
    let liveSyncTimer = null;
    let liveSyncSnapshot = { transactions: "", mechanics: "", stock: "" };

    function startLiveSync() {
      stopLiveSync();
      // polling ringan tiap 3 detik
      liveSyncTimer = setInterval(pollLiveSync, 3000);
      pollLiveSync();
    }

    function stopLiveSync() {
      if (liveSyncTimer) {
        clearInterval(liveSyncTimer);
        liveSyncTimer = null;
      }
    }

    function pollLiveSync() {
      if (!currentUser) return;
      try {
        const trx = loadTransactions();
        const mech = loadMechanics();
        const stock = loadStockMovements();

        const trxStr = JSON.stringify(trx);
        const mechStr = JSON.stringify(mech);
        const stockStr = JSON.stringify(stock);

        const needTrx = trxStr !== liveSyncSnapshot.transactions;
        const needMech = mechStr !== liveSyncSnapshot.mechanics;
        const needStock = stockStr !== liveSyncSnapshot.stock;

        if (!needTrx && !needMech && !needStock) return;

        liveSyncSnapshot.transactions = trxStr;
        liveSyncSnapshot.mechanics = mechStr;
        liveSyncSnapshot.stock = stockStr;

        if (needMech) {
          refreshMechanicSelects();
          renderMechanicsTable();
        }

        if (needTrx) {
          renderTransactionsTable();
          refreshDashboard();
        }

        if (needStock) {
          refreshStockPage();
          refreshStockDashboardCard();
        }
      } catch (e) {
        console.error("Live sync error:", e);
      }
    }



    function todayString() {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return year + "-" + month + "-" + day;
    }

    function getMonthYear(dateStr) {
      if (!dateStr || dateStr.length < 7) return { month: null, year: null };
      const [y, m] = dateStr.split("-");
      return { month: Number(m), year: Number(y) };
    }

    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    // ===== NAVIGATION & ROLE =====
    const navButtons = document.querySelectorAll(".nav-btn");
    const pages = document.querySelectorAll(".page");
    const logoutBtn = document.getElementById("logout-btn");
    const currentUsernameLabel = document.getElementById("current-username");
    const currentRoleLabel = document.getElementById("current-role-label");
    const managerStatusTools = document.getElementById("manager-status-tools");

    // STOCK DOM
    const stockForm = document.getElementById("stock-form");
    const stockRekapBody = document.getElementById("stock-rekap-body");
    const stockHistoryBody = document.getElementById("stock-history-body");
    const cardStockTotal = document.getElementById("card-stock-total");
    const stockFilterCategory = document.getElementById("stock-filter-category");
    const stockFilterDirection = document.getElementById("stock-filter-direction");

    function applyRolePermissions() {
      if (!currentUser) return;
      const role = currentUser.role;

      // Mekanik boleh lihat: Transaksi + Stock (read-only)
      // Manager: semua menu
      navButtons.forEach(btn => {
        const pageKey = btn.getAttribute("data-page");
        if (role === "mechanic") {
          if (pageKey !== "transactions" && pageKey !== "stock") {
            btn.style.display = "none";
          } else {
            btn.style.display = "";
          }
        } else {
          btn.style.display = "";
        }
      });

      // Atur akses Jenis dan Status di form Transaksi
      const trxTypeSelect = document.getElementById("trx-type");
      const trxStatusSelect = document.getElementById("trx-status");

      if (trxTypeSelect) {
        if (role === "mechanic") {
          trxTypeSelect.value = "income"; // Mekanik cuma boleh pemasukan
          trxTypeSelect.disabled = true;
        } else {
          trxTypeSelect.disabled = false; // Manager bebas pilih income/expense
        }
      }

      if (trxStatusSelect) {
        if (role === "mechanic") {
          trxStatusSelect.value = "BELOM DIBAYAR";
          trxStatusSelect.disabled = true; // Mekanik tidak boleh ganti status
        } else {
          trxStatusSelect.disabled = false; // Manager bebas
          if (!trxStatusSelect.value) trxStatusSelect.value = "LUNAS";
        }
      }

      const dashBadge = document.querySelector("#page-dashboard .badge-soft");
      if (dashBadge) {
        dashBadge.innerHTML =
          role === "manager"
            ? '<span class="badge-dot"></span> Mode Manager · bisa lihat semua data'
            : '<span class="badge-dot"></span> Mode Mekanik · Dashboard disembunyikan';
      }

      currentUsernameLabel.textContent = currentUser.username;
      currentRoleLabel.textContent = role === "manager" ? "Manager" : "Mekanik";

      if (managerStatusTools) {
        managerStatusTools.style.display = role === "manager" ? "block" : "none";
      }

      // Kunci form stock untuk selain manager
      if (stockForm) {
        const disabled = role !== "manager";
        Array.from(stockForm.elements).forEach(el => {
          el.disabled = disabled;
        });
      }

    }

    function showPage(pageKey) {
      pages.forEach(p => {
        p.style.display = p.id === "page-" + pageKey ? "" : "none";
      });
      navButtons.forEach(b => {
        if (b.getAttribute("data-page") === pageKey && b.style.display !== "none") {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });
    }

    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (!currentUser) return;
        const role = currentUser.role;
        const pageKey = btn.getAttribute("data-page");

        if (role === "mechanic" && pageKey !== "transactions" && pageKey !== "stock") {
          alert("Mekanik hanya bisa mengakses halaman Transaksi & Stock.");
          showPage("transactions");
          return;
        }
        showPage(pageKey);

        if (pageKey === "users" && role === "manager" && typeof renderUsersTable === "function") {
          renderUsersTable();
        }
      });
    });

    logoutBtn.addEventListener("click", () => {
      if (!confirm("Keluar dari akun ini?")) return;

      fetch("api/logout.php", { method: "POST" }).catch(() => {});

      stopLiveSync();
      currentUser = null;
      document.getElementById("app-container").style.display = "none";
      document.getElementById("login-screen").style.display = "flex";
    });

    // ===== LOGIN =====
    const loginForm = document.getElementById("login-form");
    const loginError = document.getElementById("login-error");
    const loginScreen = document.getElementById("login-screen");
    const appContainer = document.getElementById("app-container");

    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value;

      fetch("api/login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      })
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            loginError.textContent = data.message || "Username atau password salah.";
            loginError.style.display = "block";
            return;
          }

          loginError.style.display = "none";
          currentUser = {
            id: data.user.id,
            username: data.user.username,
            role: data.user.role
          };

          loginScreen.style.display = "none";
          appContainer.style.display = "block";

          applyRolePermissions();
          refreshMechanicSelects();
          renderMechanicsTable();
          renderTransactionsTable();
          refreshDashboard();
          refreshStockPage();
          if (currentUser.role === "manager" && typeof renderUsersTable === "function") {
            renderUsersTable();
          }

          // Live sync: auto update tanpa perlu refresh
          startLiveSync();
        })
        .catch(err => {
          console.error(err);
          loginError.textContent = "Terjadi error koneksi ke server.";
          loginError.style.display = "block";
        });
    });

    // ===== MECHANICS =====
    const mechanicForm = document.getElementById("mechanic-form");
    const mechanicsBody = document.getElementById("mechanics-body");

    const trxMechanicSelect = document.getElementById("trx-mechanic");
    const filterMechanicSelect = document.getElementById("filter-mechanic");
    const reportMechanicSelect = document.getElementById("report-mechanic");

    function refreshMechanicSelects() {
      const mechanics = loadMechanics();

      function populateSelect(selectElem, includeEmptyLabel) {
        const currentValue = selectElem.value;
        selectElem.innerHTML = "";
        if (includeEmptyLabel) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = includeEmptyLabel;
          selectElem.appendChild(opt);
        }
        mechanics.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.textContent = m.name;
          selectElem.appendChild(opt);
        });
        if (currentValue) {
          selectElem.value = currentValue;
        }
      }

      populateSelect(trxMechanicSelect, "- Tidak ada / Owner -");
      populateSelect(filterMechanicSelect, "Semua");
      populateSelect(reportMechanicSelect, "Pilih mekanik");
    }

    function renderMechanicsTable() {
      const mechanics = loadMechanics();
      mechanicsBody.innerHTML = "";
      if (mechanics.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 2;
        td.className = "empty-state";
        td.textContent = "Belum ada mekanik. Tambahkan di form sebelah kiri.";
        tr.appendChild(td);
        mechanicsBody.appendChild(tr);
        return;
      }

      mechanics.forEach(m => {
        const tr = document.createElement("tr");
        const nameTd = document.createElement("td");
        nameTd.textContent = m.name;

        const actTd = document.createElement("td");
        actTd.className = "actions";
        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-danger";
        delBtn.type = "button";
        delBtn.textContent = "Hapus";
        delBtn.addEventListener("click", () => {
          if (confirm("Hapus mekanik ini? Transaksi lama tetap ada, hanya saja nama mekanik tidak akan muncul di daftar.")) {
            const newList = loadMechanics().filter(x => x.id !== m.id);
            saveMechanics(newList);
            refreshMechanicSelects();
            renderMechanicsTable();
          }
        });
        actTd.appendChild(delBtn);

        tr.appendChild(nameTd);
        tr.appendChild(actTd);
        mechanicsBody.appendChild(tr);
      });
    }

    if (mechanicForm) {
      mechanicForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("mech-name").value.trim();
        if (!name) return;
        const mechanics = loadMechanics();
        mechanics.push({ id: generateId(), name });
        saveMechanics(mechanics);
        mechanicForm.reset();
        refreshMechanicSelects();
        renderMechanicsTable();
        alert("Mekanik disimpan.");
      });
    }

    function getMechanicById(id) {
      const mechanics = loadMechanics();
      return mechanics.find(m => m.id === id);
    }


    // ===== USER MANAGEMENT (MANAGER ONLY) =====
    const userForm = document.getElementById("user-form");
    const usersBody = document.getElementById("users-body");
    const userFormMessage = document.getElementById("user-form-message");

    function fetchUsers() {
      return fetch("api/users.php?action=list")
        .then(res => {
          if (!res.ok) throw new Error("Gagal load user");
          return res.json();
        })
        .then(data => data.users || [])
        .catch(err => {
          console.error(err);
          return [];
        });
    }

    function renderUsersTable() {
      if (!usersBody) return;
      fetchUsers().then(users => {
        usersBody.innerHTML = "";
        if (users.length === 0) {
          const tr = document.createElement("tr");
          const td = document.createElement("td");
          td.colSpan = 4;
          td.className = "empty-state";
          td.textContent = "Belum ada user.";
          tr.appendChild(td);
          usersBody.appendChild(tr);
          return;
        }

        users.forEach(u => {
          const tr = document.createElement("tr");

          const tdUser = document.createElement("td");
          tdUser.textContent = u.username;

          const tdRole = document.createElement("td");
          tdRole.textContent = u.role === "manager" ? "Manager" : "Mechanic";

          const tdCreated = document.createElement("td");
          tdCreated.textContent = u.created_at || "-";

          const tdActions = document.createElement("td");
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.textContent = "Hapus";
          delBtn.className = "btn btn-danger";
          delBtn.addEventListener("click", () => {
            if (!confirm("Hapus user " + u.username + "?")) return;
            fetch("api/users.php", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete", id: u.id })
            })
              .then(res => res.json())
              .then(data => {
                if (!data.success) {
                  alert(data.message || "Gagal menghapus user");
                  return;
                }
                renderUsersTable();
              })
              .catch(err => {
                console.error(err);
                alert("Terjadi error saat menghapus user");
              });
          });

          tdActions.appendChild(delBtn);

          tr.appendChild(tdUser);
          tr.appendChild(tdRole);
          tr.appendChild(tdCreated);
          tr.appendChild(tdActions);
          usersBody.appendChild(tr);
        });
      });
    }

    if (userForm) {
      userForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const username = document.getElementById("user-username").value.trim();
        const password = document.getElementById("user-password").value;
        const role = document.getElementById("user-role").value;

        if (!username || !password) {
          if (userFormMessage) {
            userFormMessage.textContent = "Username dan password wajib diisi.";
            userFormMessage.style.display = "inline-block";
          }
          return;
        }

        fetch("api/users.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", username, password, role })
        })
          .then(res => res.json())
          .then(data => {
            if (userFormMessage) {
              userFormMessage.textContent = data.message || (data.success ? "User dibuat." : "Gagal membuat user.");
              userFormMessage.style.display = "inline-block";
            }
            if (!data.success) return;

            document.getElementById("user-username").value = "";
            document.getElementById("user-password").value = "";
            document.getElementById("user-role").value = "mechanic";
            renderUsersTable();
          })
          .catch(err => {
            console.error(err);
            if (userFormMessage) {
              userFormMessage.textContent = "Terjadi error koneksi.";
              userFormMessage.style.display = "inline-block";
            }
          });
      });
    }
    // ===== TRANSACTIONS =====
    const transactionForm = document.getElementById("transaction-form");
    const transactionsBody = document.getElementById("transactions-body");
    const latestTransactionsBody = document.getElementById("latest-transactions-body");

    const filterType = document.getElementById("filter-type");
    const filterStart = document.getElementById("filter-start");
    const filterEnd = document.getElementById("filter-end");
    const filterStatus = document.getElementById("filter-status");
    const filterCategory = document.getElementById("filter-category");

    const bulkStatusSelect = document.getElementById("bulk-status-value");
    const bulkStatusBtn = document.getElementById("btn-bulk-status");

    const cardSaldo = document.getElementById("card-saldo");
    const cardIncomeToday = document.getElementById("card-income-today");
    const cardExpenseToday = document.getElementById("card-expense-today");
    const cardProfitToday = document.getElementById("card-profit-today");
    const monthlyHighlight = document.getElementById("monthly-highlight");

    function renderTransactionsTable() {
      const all = loadTransactions();
      const typeVal = filterType.value;
      const startVal = filterStart.value;
      const endVal = filterEnd.value;
      const mechVal = filterMechanicSelect.value;
      const statusVal = filterStatus.value;
      const catVal = filterCategory ? filterCategory.value : "";

      let rows = all;
      if (typeVal) rows = rows.filter(t => t.type === typeVal);
      if (startVal) rows = rows.filter(t => t.date >= startVal);
      if (endVal) rows = rows.filter(t => t.date <= endVal);
      if (mechVal) rows = rows.filter(t => t.mechanicId === mechVal);
      if (statusVal) rows = rows.filter(t => (t.status || "") === statusVal);
      if (catVal) rows = rows.filter(t => (t.category || "") === catVal);

      rows.sort((a, b) => b.date.localeCompare(a.date));

      transactionsBody.innerHTML = "";
      if (rows.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 8;
        td.className = "empty-state";
        td.textContent = "Belum ada transaksi. Tambahkan transaksi di form sebelah kiri.";
        tr.appendChild(td);
        transactionsBody.appendChild(tr);
        return;
      }

      rows.forEach(trx => {
        const tr = document.createElement("tr");

        const dateTd = document.createElement("td");
        dateTd.textContent = trx.date;

        const typeTd = document.createElement("td");
        const chip = document.createElement("span");
        chip.className = "chip-type " + (trx.type === "income" ? "chip-income" : "chip-expense");
        chip.textContent = trx.type === "income" ? "Pemasukan" : "Pengeluaran";
        typeTd.appendChild(chip);

        const catTd = document.createElement("td");
        catTd.textContent = trx.category || "-";

        const amountTd = document.createElement("td");
        amountTd.className = "text-right";
        amountTd.textContent = formatCurrency(trx.amount);

        const statusTd = document.createElement("td");
        const statusText = trx.status || "LUNAS";
        const spanStatus = document.createElement("span");
        spanStatus.className = "status-badge " + (statusText === "LUNAS" ? "status-lunas" : "status-belom");
        spanStatus.textContent = statusText;
        statusTd.appendChild(spanStatus);

        const mechTd = document.createElement("td");
        const mechName = trx.mechanicName || "-";
        const mechChip = document.createElement("span");
        mechChip.className = "chip-mechanic";
        mechChip.textContent = mechName;
        mechTd.appendChild(mechChip);

        const noteTd = document.createElement("td");
        const qtyVal = Number(trx.qty) || 0;
        noteTd.textContent = qtyVal > 0 ? qtyVal : "-";

        const actTd = document.createElement("td");
        actTd.className = "actions";

        // Hanya manager yang boleh menghapus transaksi
        if (currentUser && currentUser.role === "manager") {
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "btn btn-danger";
          delBtn.textContent = "Hapus";
          delBtn.addEventListener("click", () => {
            if (!confirm("Hapus transaksi ini?")) return;

            // Jika transaksi pemasukan dengan kategori yang memakai stok,
            // kembalikan stoknya (karena saat simpan dulu stok otomatis berkurang).
            if (trx.type === "income" && CATEGORY_PRICE[trx.category]) {
              const movements = loadStockMovements();
              const qtyRestore = Number(trx.qty) || 0;
              if (qtyRestore > 0) {
                movements.push({
                  id: generateId(),
                  date: todayString(),
                  category: trx.category,
                  direction: "in",
                  qty: qtyRestore,
                  note: "Auto kembali stok karena hapus transaksi",
                  createdBy: currentUser ? currentUser.username : "system"
                });
                saveStockMovements(movements);
              }
            }

            const newList = loadTransactions().filter(t => t.id !== trx.id);

            // ✅ PENTING: pakai exact agar benar-benar menghapus di server (tanpa merge)
            saveTransactions(newList, { exact: true });

            renderTransactionsTable();
            refreshDashboard();
            refreshStockPage();
            refreshStockDashboardCard();
          });
          actTd.appendChild(delBtn);
        } else {
          // Mekanik tidak punya tombol hapus
          actTd.textContent = "-";
        }

        tr.appendChild(dateTd);
        tr.appendChild(typeTd);
        tr.appendChild(catTd);
        tr.appendChild(amountTd);
        tr.appendChild(statusTd);
        tr.appendChild(mechTd);
        tr.appendChild(noteTd);
        tr.appendChild(actTd);
        transactionsBody.appendChild(tr);
      });
    }

    function renderLatestTransactions() {
      const all = loadTransactions().slice().sort((a, b) => b.date.localeCompare(a.date));
      const latest = all.slice(0, 5);

      latestTransactionsBody.innerHTML = "";
      if (latest.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 5;
        td.className = "empty-state";
        td.textContent = "Belum ada transaksi terakhir.";
        tr.appendChild(td);
        latestTransactionsBody.appendChild(tr);
        return;
      }

      latest.forEach(trx => {
        const tr = document.createElement("tr");
        const dateTd = document.createElement("td");
        dateTd.textContent = trx.date;

        const typeTd = document.createElement("td");
        typeTd.textContent = trx.type === "income" ? "Pemasukan" : "Pengeluaran";

        const catTd = document.createElement("td");
        catTd.textContent = trx.category || "-";

        const mechTd = document.createElement("td");
        mechTd.textContent = trx.mechanicName || "-";

        const amountTd = document.createElement("td");
        amountTd.className = "text-right";
        amountTd.textContent = formatCurrency(trx.amount);

        tr.appendChild(dateTd);
        tr.appendChild(typeTd);
        tr.appendChild(catTd);
        tr.appendChild(mechTd);
        tr.appendChild(amountTd);
        latestTransactionsBody.appendChild(tr);
      });
    }

    function refreshStockDashboardCard() {
      if (!cardStockTotal) return;
      const rekap = getStockRekap();
      let total = 0;
      Object.values(rekap).forEach(v => {
        const n = Number(v) || 0;
        if (n > 0) total += n;
      });
      cardStockTotal.textContent = total + " item";
    }

    function refreshDashboard() {
      const all = loadTransactions();
      const today = todayString();

      let incomeTotal = 0;
      let expenseTotal = 0;
      let incomeToday = 0;
      let expenseToday = 0;

      all.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === "income") {
          incomeTotal += amt;
          if (t.date === today) incomeToday += amt;
        } else if (t.type === "expense") {
          expenseTotal += amt;
          if (t.date === today) expenseToday += amt;
        }
      });

      const saldo = incomeTotal - expenseTotal;
      const profitToday = incomeToday - expenseToday;

      cardSaldo.textContent = formatCurrency(saldo);
      cardIncomeToday.textContent = formatCurrency(incomeToday);
      cardExpenseToday.textContent = formatCurrency(expenseToday);
      cardProfitToday.textContent = formatCurrency(profitToday);

      const now = new Date();
      const thisMonth = now.getMonth() + 1;
      const thisYear = now.getFullYear();

      let incomeMonth = 0;
      let expenseMonth = 0;

      all.forEach(t => {
        const { month, year } = getMonthYear(t.date);
        if (month === thisMonth && year === thisYear) {
          const amt = Number(t.amount) || 0;
          if (t.type === "income") incomeMonth += amt;
          else if (t.type === "expense") expenseMonth += amt;
        }
      });

      if (incomeMonth === 0 && expenseMonth === 0) {
        monthlyHighlight.textContent = "Belum ada transaksi di bulan ini.";
      } else {
        const profit = incomeMonth - expenseMonth;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        monthlyHighlight.innerHTML =
          `<div>Bulan ini (${monthNames[thisMonth - 1]} ${thisYear}):</div>
           <div>Pemasukan: <b>${formatCurrency(incomeMonth)}</b></div>
           <div>Pengeluaran: <b>${formatCurrency(expenseMonth)}</b></div>
           <div>Profit bersih: <b>${formatCurrency(profit)}</b></div>`;
      }

      renderLatestTransactions();
      refreshStockDashboardCard();
    }

    // Form transaksi + auto stok keluar
    if (transactionForm) {
      document.getElementById("trx-date").value = todayString();

      const categorySelect = document.getElementById("trx-category");
      const amountInput = document.getElementById("trx-amount");
      const qtyInput = document.getElementById("trx-qty");
      const typeSelect = document.getElementById("trx-type");
      const statusSelect = document.getElementById("trx-status");

      function updateAmountFromCategory() {
        const cat = categorySelect.value;
        const type = typeSelect.value;
        const basePrice = CATEGORY_PRICE[cat] || 0;
        const qty = Number(qtyInput.value) || 0;

        // Income + kategori punya harga list = auto (nggak bisa diubah)
        if (type === "income" && basePrice > 0) {
          amountInput.readOnly = true;
          amountInput.value = basePrice * (qty || 0);
        } else {
          // Pengeluaran atau kategori Lainnya (tanpa harga fix) = bisa diisi manual
          amountInput.readOnly = false;
          // Jangan paksa override kalau user sudah isi sendiri
          if (!amountInput.value) {
            amountInput.value = "";
          }
        }
      }

      categorySelect.addEventListener("change", updateAmountFromCategory);
      qtyInput.addEventListener("input", updateAmountFromCategory);
      typeSelect.addEventListener("change", updateAmountFromCategory);

      transactionForm.addEventListener("submit", (e) => {
        e.preventDefault();
        // Simpan mekanik yang sedang dipilih supaya tidak hilang setelah form direset
        const selectedMechanicId = document.getElementById("trx-mechanic").value || null;
        const date = document.getElementById("trx-date").value;
        const type = typeSelect.value; // income / expense
        const category = categorySelect.value;
        const qty = Number(qtyInput.value) || 0;
        const basePrice = CATEGORY_PRICE[category] || 0;
        // Mekanik sudah dikunci statusnya di applyRolePermissions, tapi kita tetap baca value
        const status = statusSelect.value || "LUNAS";
        const mechanicId = selectedMechanicId;
        const mechanic = mechanicId ? getMechanicById(mechanicId) : null;
        const mechanicName = mechanic ? mechanic.name : "";
        const note = document.getElementById("trx-note").value.trim();

        if (!date || !category) {
          alert("Tanggal dan kategori wajib diisi.");
          return;
        }

        if (type === "income") {
          if (qty <= 0) {
            alert("Jumlah minimal 1 untuk pemasukan.");
            return;
          }
        }

        let amount;
        // Income + kategori list = hitung dari harga x jumlah
        if (type === "income" && basePrice > 0) {
          amount = basePrice * qty;
        } else {
          // Expense atau Lainnya = ambil dari input manual
          amount = Number(amountInput.value) || 0;
        }

        if (amount <= 0) {
          alert("Nominal harus lebih dari 0.");
          return;
        }

        const trx = {
          id: generateId(),
          date,
          type,
          category,
          qty,
          unitPrice: basePrice > 0 ? basePrice : null,
          amount,
          status,
          mechanicId,
          mechanicName,
          note
        };

        // Simpan transaksi
        const list = loadTransactions();
        list.push(trx);
        saveTransactions(list);

        // AUTO: kurangi stok kalau transaksi pemasukan dan kategori punya stock
        // Asumsi: income = barang/jasa dipakai keluar dari stok
        if (type === "income" && CATEGORY_PRICE[category]) {
          const stockMovements = loadStockMovements();
          stockMovements.push({
            id: generateId(),
            date,
            category,
            direction: "out",
            qty,
            note: "Auto keluar stok dari transaksi",
            createdBy: currentUser ? currentUser.username : "system"
          });
          saveStockMovements(stockMovements);
          refreshStockPage();
          refreshStockDashboardCard();
        }

        // Reset form
        transactionForm.reset();
        document.getElementById("trx-date").value = todayString();
        typeSelect.value = "income";

        // Set default status sesuai role:
        if (currentUser && currentUser.role === "mechanic") {
          statusSelect.value = "BELOM DIBAYAR";
        } else {
          statusSelect.value = "LUNAS";
        }

        categorySelect.value = "";
        qtyInput.value = 1;
        amountInput.value = "";

        // Pastikan rule role tetap (supaya mekanik tetap terkunci)
        applyRolePermissions();
        renderTransactionsTable();
        refreshDashboard();

        // Kembalikan pilihan mekanik seperti sebelum simpan
        if (selectedMechanicId) {
          document.getElementById("trx-mechanic").value = selectedMechanicId;
        }

        alert("Transaksi disimpan.");
      });
    }

    [filterType, filterStart, filterEnd, filterMechanicSelect, filterStatus, filterCategory].forEach(el => {
      if (el) el.addEventListener("change", () => renderTransactionsTable());
    });

    // Manager: ubah status massal sesuai filter
    if (bulkStatusBtn) {
      bulkStatusBtn.addEventListener("click", () => {
        if (!currentUser || currentUser.role !== "manager") {
          alert("Hanya manager yang bisa mengubah status di sini.");
          return;
        }
        const newStatus = bulkStatusSelect.value;
        if (!newStatus) {
          alert("Pilih status baru terlebih dahulu.");
          return;
        }

        const all = loadTransactions();
        const typeVal = filterType.value;
        const startVal = filterStart.value;
        const endVal = filterEnd.value;
        const mechVal = filterMechanicSelect.value;
        const statusVal = filterStatus.value;
        const catVal = filterCategory ? filterCategory.value : "";

        let changed = 0;
        all.forEach(t => {
          let ok = true;
          if (typeVal && t.type !== typeVal) ok = false;
          if (startVal && t.date < startVal) ok = false;
          if (endVal && t.date > endVal) ok = false;
          if (mechVal && t.mechanicId !== mechVal) ok = false;
          if (statusVal && (t.status || "") !== statusVal) ok = false;
          if (catVal && (t.category || "") !== catVal) ok = false;

          if (ok) {
            t.status = newStatus;
            changed++;
          }
        });

        if (changed === 0) {
          alert("Tidak ada transaksi yang cocok dengan filter.");
          return;
        }

        saveTransactions(all);
        renderTransactionsTable();
        alert("Status diperbarui untuk " + changed + " transaksi.");
      });
    }

        // ===== EXPORT KE EXCEL =====
        document.getElementById("btn-export").addEventListener("click", () => {
      const all = loadTransactions();
      if (!all.length) {
        alert("Belum ada transaksi untuk di-export.");
        return;
      }

      // --- ambil filter yang ada di halaman ---
      const typeVal = filterType.value;
      const startVal = filterStart.value;
      const endVal = filterEnd.value;
      const mechVal = filterMechanicSelect.value;
      const statusVal = filterStatus.value;
      const catVal = filterCategory ? filterCategory.value : "";

      let rowsData = all;

      if (typeVal) {
        rowsData = rowsData.filter(t => t.type === typeVal);
      }

      if(catVal) {
        rowsData = rowsData.filter(t => (t.category || "") === catVal)
      }

      // fungsi bantu: ubah "YYYY-MM-DD" jadi timestamp
      const parseDate = (str) => {
        if (!str) return null;
        const parts = str.split("-");
        if (parts.length !== 3) return null;
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const d = Number(parts[2]);
        return new Date(y, m, d).getTime();
      };

      const startTs = parseDate(startVal);
      const endTs = parseDate(endVal);

      if (startTs) {
        rowsData = rowsData.filter(t => {
          const tTs = parseDate(t.date);
          return tTs && tTs >= startTs;
        });
      }

      if (endTs) {
        rowsData = rowsData.filter(t => {
          const tTs = parseDate(t.date);
          return tTs && tTs <= endTs;
        });
      }

      if (mechVal) {
        rowsData = rowsData.filter(t => t.mechanicId === mechVal);
      }

      if (statusVal) {
        rowsData = rowsData.filter(t => (t.status || "") === statusVal);
      }

      if (!rowsData.length) {
        alert("Tidak ada transaksi yang cocok dengan filter untuk di-export.");
        return;
      }

      // urutkan berdasarkan tanggal
      rowsData = rowsData.slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));

      // hitung total nominal dan total qty komponen
      const totalAmount = rowsData.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const totalQty = rowsData.reduce((sum, t) => sum + (Number(t.qty) || 0), 0);

      // header kolom
      const header = [
        "Tanggal",
        "Jenis",
        "Kategori",
        "Nominal",
        "Status",
        "Mekanik",
        "Jumlah komponen yang diambil"
      ];

      // teks filter untuk bagian meta laporan
      let periodeText = "Semua tanggal";
      if (startVal && endVal) {
        periodeText = `${startVal} s.d. ${endVal}`;
      } else if (startVal) {
        periodeText = `>= ${startVal}`;
      } else if (endVal) {
        periodeText = `<= ${endVal}`;
      }

      const jenisText = typeVal
        ? (typeVal === "income" ? "Pemasukan" : "Pengeluaran")
        : "Semua";

      let mekanikFilterText = "Semua";
      if (mechVal) {
        const opt = filterMechanicSelect.options[filterMechanicSelect.selectedIndex];
        mekanikFilterText = opt ? opt.textContent : "Mekanik dipilih";
      }

      const statusFilterText = statusVal || "Semua";

      const escapeHtml = (str) =>
        String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      const colCount = header.length;

      let html = "<html><head><meta charset='UTF-8'><style>";
      html += "body{font-family:Arial,Helvetica,sans-serif;font-size:12px;}";
      html += "table{border-collapse:collapse;width:100%;}";
      html += "th,td{border:1px solid #d1d5db;padding:4px 6px;font-size:12px;}";
      html += "th{background:#16a34a;color:#ffffff;text-align:left;}";
      html += "tr:nth-child(even) td{background:#f9fafb;}";
      html += ".title-row th{background:#0f172a;color:#ffffff;font-size:14px;padding:8px 6px;}";
      html += ".meta-label{font-weight:bold;width:140px;background:#e5e7eb;}";
      html += ".meta-value{background:#f9fafb;}";
      html += ".currency{mso-number-format:'\\0022IDP$\\0022 #,##0';text-align:right;}";
      html += ".number{mso-number-format:'#,##0';text-align:right;}";
      html += "table.summary{margin-top:16px;width:auto;}";
      html += "table.summary th{background:#0f172a;color:#ffffff;}";
      html += "table.summary td{background:#f9fafb;}";
      html += "</style></head><body>";

      // Tabel utama
      html += "<table>";
      html += `<tr class="title-row"><th colspan="${colCount}">Laporan Keuangan Bengkel Gho Auto Repair</th></tr>`;
      html += `<tr><td class="meta-label">Periode</td><td class="meta-value" colspan="${colCount - 1}">${escapeHtml(periodeText)}</td></tr>`;
      html += `<tr><td class="meta-label">Filter Jenis</td><td class="meta-value" colspan="${colCount - 1}">${escapeHtml(jenisText)}</td></tr>`;
      html += `<tr><td class="meta-label">Filter Mekanik</td><td class="meta-value" colspan="${colCount - 1}">${escapeHtml(mekanikFilterText)}</td></tr>`;
      html += `<tr><td class="meta-label">Filter Status</td><td class="meta-value" colspan="${colCount - 1}">${escapeHtml(statusFilterText)}</td></tr>`;
      html += "<tr><td colspan=\"" + colCount + "\"></td></tr>";

      // header tabel data
      html += "<tr>";
      header.forEach(h => {
        html += "<th>" + escapeHtml(h) + "</th>";
      });
      html += "</tr>";

      // isi tabel data
      rowsData.forEach(t => {
        html += "<tr>";
        html += "<td>" + escapeHtml(t.date || "") + "</td>";
        html += "<td>" + escapeHtml(t.type === "income" ? "Pemasukan" : "Pengeluaran") + "</td>";
        html += "<td>" + escapeHtml(t.category || "") + "</td>";
        html += `<td class="currency">${Number(t.amount) || 0}</td>`;
        html += "<td>" + escapeHtml(t.status || "") + "</td>";
        html += "<td>" + escapeHtml(t.mechanicName || "") + "</td>";
        html += `<td class="number">${Number(t.qty) || 0}</td>`;
        html += "</tr>";
      });

      html += "</table>";

      // Tabel ringkasan total
      html += "<br/><table class=\"summary\">";
      html += "<tr><th colspan=\"2\">Ringkasan Total</th></tr>";
      html += `<tr><td>Total Nominal</td><td class="currency">${totalAmount}</td></tr>`;
      html += `<tr><td>Total Jumlah Komponen</td><td class="number">${totalQty}</td></tr>`;
      html += "</table>";

      html += "</body></html>";

      const blob = new Blob([html], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "laporan_keuangan_bengkel.xls";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });


    // ===== REPORTS =====
    const reportMonth = document.getElementById("report-month");
    const reportYear = document.getElementById("report-year");
    const reportMechMonth = document.getElementById("report-mech-month");
    const reportMechYear = document.getElementById("report-mech-year");
    const reportSummary = document.getElementById("report-summary");
    const mechanicReport = document.getElementById("mechanic-report");

    function populateMonthYearSelects() {
      const monthSelects = [reportMonth, reportMechMonth];
      const yearSelects = [reportYear, reportMechYear];

      const monthNames = ["01 - Jan", "02 - Feb", "03 - Mar", "04 - Apr", "05 - Mei", "06 - Jun", "07 - Jul", "08 - Agu", "09 - Sep", "10 - Okt", "11 - Nov", "12 - Des"];

      monthSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = "";
        monthNames.forEach((label, idx) => {
          const opt = document.createElement("option");
          opt.value = idx + 1;
          opt.textContent = label;
          sel.appendChild(opt);
        });
      });

      const now = new Date();
      const currentYear = now.getFullYear();
      const yearsRange = [];
      for (let y = currentYear - 3; y <= currentYear + 1; y++) {
        yearsRange.push(y);
      }

      yearSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = "";
        yearsRange.forEach(y => {
          const opt = document.createElement("option");
          opt.value = y;
          opt.textContent = y;
          sel.appendChild(opt);
        });
      });

      if (reportMonth) reportMonth.value = now.getMonth() + 1;
      if (reportMechMonth) reportMechMonth.value = now.getMonth() + 1;
      if (reportYear) reportYear.value = currentYear;
      if (reportMechYear) reportMechYear.value = currentYear;
    }

    document.getElementById("btn-generate-report").addEventListener("click", () => {
      const m = Number(reportMonth.value);
      const y = Number(reportYear.value);
      const all = loadTransactions();
      let income = 0;
      let expense = 0;
      const perCategory = {};

      all.forEach(t => {
        const { month, year } = getMonthYear(t.date);
        if (month === m && year === y) {
          const amt = Number(t.amount) || 0;
          if (t.type === "income") income += amt;
          else if (t.type === "expense") expense += amt;

          const key = t.category || "Lainnya";
          if (!perCategory[key]) perCategory[key] = { income: 0, expense: 0 };
          if (t.type === "income") perCategory[key].income += amt;
          else perCategory[key].expense += amt;
        }
      });

      if (income === 0 && expense === 0) {
        reportSummary.innerHTML = `<div class="empty-state">Tidak ada transaksi di bulan ini.</div>`;
        return;
      }

      const profit = income - expense;
      let html = "";
      html += `<div class="section-sub" style="margin-bottom:6px;">Ringkasan bulan ${m.toString().padStart(2,"0")}/${y}</div>`;
      html += `<div>Pemasukan: <b>${formatCurrency(income)}</b></div>`;
      html += `<div>Pengeluaran: <b>${formatCurrency(expense)}</b></div>`;
      html += `<div>Profit bersih: <b>${formatCurrency(profit)}</b></div>`;
      html += `<div class="mt-2 section-sub">Rincian per kategori:</div>`;
      html += `<div class="table-wrapper period-report-wrapper mt-2"><table><thead><tr><th>Kategori</th><th>Pemasukan</th><th>Pengeluaran</th></tr></thead><tbody>`;
      Object.keys(perCategory).forEach(cat => {
        const c = perCategory[cat];
        html += `<tr>
          <td>${cat}</td>
          <td>${formatCurrency(c.income)}</td>
          <td>${formatCurrency(c.expense)}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      reportSummary.innerHTML = html;
    
    // ===== STOCK REPORT (stok per tanggal) =====
    const reportStockDate = document.getElementById("report-stock-date");
    const stockReportSummary = document.getElementById("stock-report-summary");

    function getStockRekapAsOf(dateStr) {
      const allMovements = loadStockMovements();
      const filtered = allMovements.filter(m => (m.date || "") <= dateStr);
      return stockTotalsByCategory(filtered);
    }

    function renderStockReport(dateStr) {
      if (!stockReportSummary) return;

      if (!dateStr) {
        stockReportSummary.innerHTML = '<div class="empty-state">Tanggal wajib diisi.</div>';
        return;
      }

      const rekap = getStockRekapAsOf(dateStr);
      const cats = Object.keys(rekap).sort();

      let html = "";
      html += `<div class="section-sub" style="margin-bottom:6px;">Stok per kategori (per ${dateStr})</div>`;
      html += `<div class="table-wrapper stock-report-wrapper mt-2"><table><thead><tr><th>Kategori</th><th class="text-right">Sisa Stok</th></tr></thead><tbody>`;

      cats.forEach(cat => {
        html += `<tr><td>${cat}</td><td class="text-right">${Number(rekap[cat] || 0)} item</td></tr>`;
      });

      html += `</tbody></table></div>`;
      stockReportSummary.innerHTML = html;
    }

    const btnStockReport = document.getElementById("btn-generate-stock-report");
    if (btnStockReport) {
      btnStockReport.addEventListener("click", () => {
        renderStockReport(reportStockDate ? reportStockDate.value : "");
      });
    }


    });

    document.getElementById("btn-mechanic-report").addEventListener("click", () => {
      const mechId = reportMechanicSelect.value;
      if (!mechId) {
        alert("Pilih mekanik terlebih dahulu.");
        return;
      }
      const m = Number(reportMechMonth.value);
      const y = Number(reportMechYear.value);

      const mech = getMechanicById(mechId);
      if (!mech) {
        alert("Data mekanik tidak ditemukan.");
        return;
      }

      const all = loadTransactions();
      let mechIncome = 0;
      let jobCount = 0;

      all.forEach(t => {
        const { month, year } = getMonthYear(t.date);
        if (month === m && year === y && t.mechanicId === mechId && t.type === "income") {
          const amt = Number(t.amount) || 0;
          mechIncome += amt;
          jobCount++;
        }
      });

      if (jobCount === 0) {
        mechanicReport.innerHTML = `<div class="empty-state">Tidak ada pergerakan untuk mekanik <b>${mech.name}</b> di periode ini.</div>`;
        return;
      }

      let html = "";
      html += `<div>Mekanik: <b>${mech.name}</b></div>`;
      html += `<div>Periode: <b>${m.toString().padStart(2,"0")}/${y}</b></div>`;
      html += `<div>Total pergerakan: <b>${jobCount}</b></div>`;
      html += `<div>Total pemasukan dari pergerakan-nya: <b>${formatCurrency(mechIncome)}</b></div>`;
      html += `<div class="section-sub">Gunakan angka ini jika ingin bagi hasil secara manual.</div>`;
      mechanicReport.innerHTML = html;
    });

    // ===== STOCK RENDERING =====
        function renderStockRekapTable() {
          if (!stockRekapBody) return;

          const rekap = getStockRekap();
          const cats = Object.keys(rekap).sort();
          stockRekapBody.innerHTML = "";

          if (cats.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 2;
            td.className = "empty-state";
            td.textContent = "Belum ada data stok. Input pergerakan stok terlebih dahulu.";
            tr.appendChild(td);
            stockRekapBody.appendChild(tr);
            return;
          }

          cats.forEach(cat => {
            const tr = document.createElement("tr");
            const tdCat = document.createElement("td");
            tdCat.textContent = cat;

            const tdQty = document.createElement("td");
            tdQty.className = "text-right";
            tdQty.textContent = (rekap[cat] || 0) + " item";

            tr.appendChild(tdCat);
            tr.appendChild(tdQty);
            stockRekapBody.appendChild(tr);
          });
        }

      if (stockFilterCategory) {
        stockFilterCategory.addEventListener("change", () => {
          renderStockHistoryTable();
        });
      }

      function renderStockHistoryTable() {
      if (!stockHistoryBody) return;

      const selectedCat = stockFilterCategory ? stockFilterCategory.value : "";
      const selectedDir = stockFilterDirection ? stockFilterDirection.value : "";

      const all = loadStockMovements().slice().sort((a, b) => b.date.localeCompare(a.date));

      const rows = all.filter(m => {
        if (selectedCat && m.category !== selectedCat) return false;
        if (selectedDir && m.direction !== selectedDir) return false;
        return true;
      });

      stockHistoryBody.innerHTML = "";

      if (rows.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.className = "empty-state";
        const jenisLabel = selectedDir ? (selectedDir === "in" ? "Masuk" : "Keluar") : "";
        td.textContent =
          selectedCat && selectedDir
            ? `Belum ada pergerakan stok ${jenisLabel} untuk kategori "${selectedCat}".`
            : selectedCat
            ? `Belum ada pergerakan stok untuk kategori "${selectedCat}".`
            : selectedDir
            ? `Belum ada pergerakan stok ${jenisLabel}.`
            : "Belum ada pergerakan stok.";
        tr.appendChild(td);
        stockHistoryBody.appendChild(tr);
        return;
      }

      rows.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${m.date}</td>
          <td>${m.category || "-"}</td>
          <td>${m.direction === "in" ? "Masuk" : "Keluar"}</td>
          <td class="text-right">${(Number(m.qty) || 0)} item</td>
          <td>${m.createdBy || "-"}</td>
          <td>${m.note || "-"}</td>
        `;
        stockHistoryBody.appendChild(tr);
      });
    }

    function refreshStockPage() {
      renderStockRekapTable();
      renderStockHistoryTable();
    }

    if (stockFilterCategory) {
      stockFilterCategory.addEventListener("change", () => {
        renderStockHistoryTable();
      });
    }

    if (stockFilterDirection) {
      stockFilterDirection.addEventListener("change", () => {
        renderStockHistoryTable();
      });
    }

    // ===== STOCK FORM =====
    if (stockForm) {
      const stockDateInput = document.getElementById("stock-date");
      const stockCategorySelect = document.getElementById("stock-category");
      const stockDirectionSelect = document.getElementById("stock-direction");
      const stockQtyInput = document.getElementById("stock-qty");
      const stockNoteInput = document.getElementById("stock-note");

      stockDateInput.value = todayString();

      stockForm.addEventListener("submit", (e) => {
        e.preventDefault();

        if (!currentUser || currentUser.role !== "manager") {
          alert("Hanya manager yang boleh menginput stok.");
          return;
        }

        const date = stockDateInput.value;
        const category = stockCategorySelect.value;
        const direction = stockDirectionSelect.value; // in / out
        const qty = Number(stockQtyInput.value) || 0;
        const note = stockNoteInput.value.trim();

        if (!date || !category) {
          alert("Tanggal dan kategori wajib diisi.");
          return;
        }
        if (qty <= 0) {
          alert("Jumlah stok harus lebih dari 0.");
          return;
        }

        const movements = loadStockMovements();
        movements.push({
          id: generateId(),
          date,
          category,
          direction,
          qty,
          note,
          createdBy: currentUser.username
        });
        saveStockMovements(movements);

        stockForm.reset();
        stockDateInput.value = todayString();
        stockDirectionSelect.value = "in";
        stockQtyInput.value = 1;

        refreshStockPage();
        refreshStockDashboardCard();
        alert("Pergerakan stok disimpan.");
      });
    }

    // ===== INITIAL LOAD =====
    window.addEventListener("DOMContentLoaded", () => {
      populateMonthYearSelects();
      const rsd = document.getElementById("report-stock-date");
      if (rsd) rsd.value = todayString();
      // Di awal muat, paksa user login dulu di server.
      loginScreen.style.display = "flex";
      appContainer.style.display = "none";
    });

    function toggleSidebar() {
      const sb = document.querySelector(".sidebar");
      sb.classList.toggle("show");

      let backdrop = document.querySelector(".sidebar-backdrop");
      if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.className = "sidebar-backdrop";
        backdrop.onclick = toggleSidebar;
        document.body.appendChild(backdrop);
      }
      backdrop.classList.toggle("active");
    }