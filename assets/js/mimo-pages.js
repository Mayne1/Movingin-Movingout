/* MIMO page wiring */
(function (window, document) {
  "use strict";

  var MIMO = window.MIMO;

  function byId(id) {
    return document.getElementById(id);
  }

  function escHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setText(id, value) {
    var el = byId(id);
    if (el) {
      el.textContent = value;
    }
  }

  function markActiveNav(page) {
    var links = document.querySelectorAll("[data-nav]");
    links.forEach(function (link) {
      if (link.getAttribute("data-nav") === page) {
        link.classList.add("bg-primary", "text-white");
      } else {
        link.classList.remove("bg-primary", "text-white");
      }
    });
  }

  function renderSessionOptions(selectEl, typeFilter, placeholder) {
    if (!selectEl) {
      return;
    }
    var sessions = MIMO.loadSessions().filter(function (s) {
      return !typeFilter || s.type === typeFilter;
    });
    selectEl.innerHTML = "<option value=\"\">" + escHtml(placeholder || "Select") + "</option>" +
      sessions.map(function (s) {
        return "<option value=\"" + s.id + "\">" + escHtml(s.propertyName + " - " + s.type + " (" + MIMO.fmtDate(s.createdAt) + ")") + "</option>";
      }).join("");
  }

  function initDashboard() {
    var sessions = MIMO.loadSessions();
    var active = MIMO.getActiveSession();
    var roomCount = 0;
    var itemCount = 0;
    sessions.forEach(function (s) {
      roomCount += (s.rooms || []).length;
      (s.rooms || []).forEach(function (r) {
        itemCount += (r.items || []).length;
      });
    });
    setText("dashSessionCount", String(sessions.length));
    setText("dashRoomCount", String(roomCount));
    setText("dashItemCount", String(itemCount));
    setText("dashActiveSession", active ? (active.propertyName + " (" + active.type + ")") : "None selected");
  }

  function initSessionsPage() {
    var form = byId("sessionForm");
    var list = byId("sessionList");

    function renderSessions() {
      var activeId = MIMO.getActiveSessionId();
      var sessions = MIMO.loadSessions().sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      if (!sessions.length) {
        list.innerHTML = "<div class=\"text-sm text-secondary-foreground\">No sessions yet.</div>";
        return;
      }

      list.innerHTML = sessions.map(function (session) {
        var roomCount = (session.rooms || []).length;
        var totalItems = (session.rooms || []).reduce(function (sum, room) {
          return sum + (room.items || []).length;
        }, 0);
        return "<div class=\"border rounded-xl p-4 mb-3 bg-light\">" +
          "<div class=\"flex flex-wrap justify-between gap-3\">" +
          "<div><div class=\"font-semibold\">" + escHtml(session.propertyName) + "</div>" +
          "<div class=\"text-xs text-muted-foreground\">" + escHtml(session.type) + " | " + escHtml(MIMO.fmtDate(session.createdAt)) + "</div>" +
          "<div class=\"text-xs text-muted-foreground\">Rooms: " + roomCount + " | Items: " + totalItems + "</div></div>" +
          "<div class=\"flex gap-2\">" +
          (activeId === session.id ? "<span class=\"kt-badge kt-badge-outline kt-badge-success\">Active</span>" : "<button class=\"kt-btn kt-btn-sm kt-btn-outline\" data-action=\"activate\" data-id=\"" + session.id + "\">Set Active</button>") +
          "<button class=\"kt-btn kt-btn-sm kt-btn-outline kt-btn-danger\" data-action=\"delete\" data-id=\"" + session.id + "\">Delete</button>" +
          "</div></div></div>";
      }).join("");
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var type = byId("sessionType").value;
      var propertyName = byId("propertyName").value;
      if (!propertyName.trim()) {
        alert("Property name is required.");
        return;
      }
      MIMO.createSession(type, propertyName);
      form.reset();
      renderSessions();
    });

    list.addEventListener("click", function (event) {
      var target = event.target;
      var action = target.getAttribute("data-action");
      var sessionId = target.getAttribute("data-id");
      if (!action || !sessionId) {
        return;
      }
      if (action === "activate") {
        MIMO.setActiveSessionId(sessionId);
      }
      if (action === "delete") {
        if (window.confirm("Delete this session and all its room items?")) {
          MIMO.deleteSession(sessionId);
        }
      }
      renderSessions();
    });

    renderSessions();
  }

  function initCapturePage() {
    var sessionSummary = byId("captureSessionSummary");
    var roomSelect = byId("roomSelect");
    var roomNameInput = byId("roomName");
    var addRoomBtn = byId("addRoomBtn");
    var noteInput = byId("captureNote");
    var fileInput = byId("captureFile");
    var tryCameraBtn = byId("tryCameraBtn");
    var cameraStatus = byId("cameraStatus");
    var roomItems = byId("roomItems");
    var storageMessage = byId("storageMessage");

    function activeSession() {
      return MIMO.getActiveSession();
    }

    function renderRooms() {
      var session = activeSession();
      if (!session) {
        roomSelect.innerHTML = "<option value=\"\">No active session</option>";
        sessionSummary.textContent = "No active session. Create or activate one in Sessions.";
        roomItems.innerHTML = "";
        return;
      }
      sessionSummary.textContent = session.propertyName + " (" + session.type + ") | " + MIMO.fmtDate(session.createdAt);
      var rooms = session.rooms || [];
      roomSelect.innerHTML = "<option value=\"\">Select room</option>" +
        rooms.map(function (r) {
          return "<option value=\"" + escHtml(r.name) + "\">" + escHtml(r.name) + " (" + (r.items || []).length + " items)</option>";
        }).join("");
      if (rooms.length) {
        roomSelect.value = rooms[0].name;
      }
      renderRoomItems();
    }

    function renderRoomItems() {
      var session = activeSession();
      var roomName = roomSelect.value;
      if (!session || !roomName) {
        roomItems.innerHTML = "<div class=\"text-sm text-secondary-foreground\">Select a room to view captured items.</div>";
        return;
      }
      var room = (session.rooms || []).find(function (r) { return r.name === roomName; });
      var items = room && room.items ? room.items : [];
      if (!items.length) {
        roomItems.innerHTML = "<div class=\"text-sm text-secondary-foreground\">No items yet in this room.</div>";
        return;
      }
      roomItems.innerHTML = items.slice().reverse().map(function (item) {
        var thumb = item.kind === "photo" && item.thumb
          ? "<img src=\"" + item.thumb + "\" alt=\"Photo thumb\" class=\"w-20 h-20 rounded object-cover border\"/>"
          : "<div class=\"w-20 h-20 rounded border flex items-center justify-center text-xs p-2 text-center\">Video metadata only</div>";
        var storageNote = item.kind === "photo"
          ? "Stored: compressed thumbnail + metadata."
          : "Stored: metadata only. Video requires re-upload to view.";
        return "<div class=\"flex gap-3 border rounded-xl p-3 mb-2 bg-light\">" +
          thumb +
          "<div class=\"text-sm\">" +
          "<div class=\"font-medium\">" + escHtml(item.kind.toUpperCase()) + " | " + escHtml(item.fileName || "Unnamed file") + "</div>" +
          "<div class=\"text-xs text-muted-foreground\">" + escHtml(MIMO.fmtDate(item.ts)) + "</div>" +
          "<div class=\"text-xs mt-1\">" + escHtml(item.note || "No note") + "</div>" +
          "<div class=\"text-xs mt-1 text-muted-foreground\">" + escHtml(storageNote) + "</div>" +
          "</div></div>";
      }).join("");
    }

    addRoomBtn.addEventListener("click", function () {
      var session = activeSession();
      if (!session) {
        alert("No active session.");
        return;
      }
      var roomName = roomNameInput.value.trim();
      if (!roomName) {
        alert("Room name is required.");
        return;
      }
      MIMO.addRoom(session.id, roomName);
      roomNameInput.value = "";
      renderRooms();
      roomSelect.value = roomName;
      renderRoomItems();
    });

    roomSelect.addEventListener("change", renderRoomItems);

    fileInput.addEventListener("change", async function () {
      var session = activeSession();
      var roomName = roomSelect.value;
      if (!session) {
        alert("No active session.");
        fileInput.value = "";
        return;
      }
      if (!roomName) {
        alert("Select a room first.");
        fileInput.value = "";
        return;
      }

      var files = Array.prototype.slice.call(fileInput.files || []);
      if (!files.length) {
        return;
      }

      storageMessage.textContent = "Processing files...";
      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        var item = await MIMO.createCaptureItem(file, noteInput.value);
        MIMO.addItemToRoom(session.id, roomName, item);
      }
      storageMessage.textContent = "Saved. Photos store compressed thumbnails + metadata. Videos store metadata only.";
      fileInput.value = "";
      noteInput.value = "";
      renderRooms();
      roomSelect.value = roomName;
      renderRoomItems();
    });

    tryCameraBtn.addEventListener("click", async function () {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        cameraStatus.textContent = "Camera API unavailable in this browser. Use the file picker instead.";
        return;
      }
      cameraStatus.textContent = "Requesting camera permission...";
      try {
        var stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(function (track) { track.stop(); });
        cameraStatus.textContent = "Camera permission granted. You can still use the file picker for capture.";
      } catch (error) {
        cameraStatus.textContent = "Camera access denied/unavailable. Use file picker fallback.";
      }
    });

    renderRooms();
  }

  function initComparePage() {
    var moveInSelect = byId("compareMoveIn");
    var moveOutSelect = byId("compareMoveOut");
    var results = byId("compareResults");
    var saveSelectionBtn = byId("saveCompareSelection");
    var saved = MIMO.loadReportSelection();

    function render() {
      var moveIn = MIMO.getSessionById(moveInSelect.value);
      var moveOut = MIMO.getSessionById(moveOutSelect.value);
      if (!moveIn || !moveOut) {
        results.innerHTML = "<div class=\"text-sm text-secondary-foreground\">Pick one move-in and one move-out session.</div>";
        return;
      }
      var compared = MIMO.compareSessions(moveIn, moveOut);
      if (!compared.length) {
        results.innerHTML = "<div class=\"text-sm text-secondary-foreground\">No rooms found across these sessions.</div>";
        return;
      }

      results.innerHTML = compared.map(function (entry) {
        var max = Math.max(entry.moveIn.photos.length, entry.moveOut.photos.length, 1);
        var thumbs = [];
        for (var i = 0; i < max; i += 1) {
          var inPhoto = entry.moveIn.photos[i];
          var outPhoto = entry.moveOut.photos[i];
          thumbs.push(
            "<div class=\"grid grid-cols-2 gap-2 mb-2\">" +
            "<div class=\"border rounded p-2 text-xs\">" +
            (inPhoto && inPhoto.thumb ? "<img src=\"" + inPhoto.thumb + "\" class=\"w-full h-28 object-cover rounded\" alt=\"move-in thumb\"/>" : "<div class=\"h-28 flex items-center justify-center text-muted-foreground\">No photo</div>") +
            "</div>" +
            "<div class=\"border rounded p-2 text-xs\">" +
            (outPhoto && outPhoto.thumb ? "<img src=\"" + outPhoto.thumb + "\" class=\"w-full h-28 object-cover rounded\" alt=\"move-out thumb\"/>" : "<div class=\"h-28 flex items-center justify-center text-muted-foreground\">No photo</div>") +
            "</div>" +
            "</div>"
          );
        }

        return "<div class=\"border rounded-xl p-4 mb-4 bg-light\">" +
          "<div class=\"font-semibold mb-2\">" + escHtml(entry.roomName) + "</div>" +
          "<div class=\"grid md:grid-cols-2 gap-3 text-sm mb-3\">" +
          "<div><div class=\"font-medium mb-1\">Move-in</div>" +
          "<div>Items: " + entry.moveIn.total + "</div>" +
          "<div>Notes: " + escHtml(entry.moveIn.notes.join(" | ") || "-") + "</div>" +
          "<div>Timestamps: " + escHtml(entry.moveIn.timestamps.map(MIMO.fmtDate).join(" | ") || "-") + "</div>" +
          "<div class=\"mt-1 text-xs text-muted-foreground\">Videos: " + entry.moveIn.videos.length + " (metadata only)</div></div>" +
          "<div><div class=\"font-medium mb-1\">Move-out</div>" +
          "<div>Items: " + entry.moveOut.total + "</div>" +
          "<div>Notes: " + escHtml(entry.moveOut.notes.join(" | ") || "-") + "</div>" +
          "<div>Timestamps: " + escHtml(entry.moveOut.timestamps.map(MIMO.fmtDate).join(" | ") || "-") + "</div>" +
          "<div class=\"mt-1 text-xs text-muted-foreground\">Videos: " + entry.moveOut.videos.length + " (metadata only)</div></div>" +
          "</div>" +
          "<div><div class=\"text-xs text-muted-foreground mb-1\">Photo thumbnails side-by-side</div>" + thumbs.join("") + "</div>" +
          "</div>";
      }).join("");
    }

    renderSessionOptions(moveInSelect, "move-in", "Select move-in session");
    renderSessionOptions(moveOutSelect, "move-out", "Select move-out session");
    if (saved.moveInId) {
      moveInSelect.value = saved.moveInId;
    }
    if (saved.moveOutId) {
      moveOutSelect.value = saved.moveOutId;
    }
    render();

    moveInSelect.addEventListener("change", render);
    moveOutSelect.addEventListener("change", render);
    saveSelectionBtn.addEventListener("click", function () {
      MIMO.saveReportSelection(moveInSelect.value, moveOutSelect.value);
      alert("Selection saved for Report page.");
    });
  }

  function initReportPage() {
    var moveInSelect = byId("reportMoveIn");
    var moveOutSelect = byId("reportMoveOut");
    var generateBtn = byId("generateReportBtn");
    var downloadBtn = byId("downloadReportBtn");
    var exportJsonBtn = byId("exportJsonBtn");
    var preview = byId("reportPreview");
    var latestReportHtml = "";
    var saved = MIMO.loadReportSelection();

    renderSessionOptions(moveInSelect, "move-in", "Select move-in session");
    renderSessionOptions(moveOutSelect, "move-out", "Select move-out session");
    if (saved.moveInId) {
      moveInSelect.value = saved.moveInId;
    }
    if (saved.moveOutId) {
      moveOutSelect.value = saved.moveOutId;
    }

    function renderPreview() {
      var moveIn = MIMO.getSessionById(moveInSelect.value);
      var moveOut = MIMO.getSessionById(moveOutSelect.value);
      if (!moveIn || !moveOut) {
        preview.innerHTML = "<div class=\"text-sm text-secondary-foreground\">Select sessions and click Generate report.</div>";
        return;
      }

      var compared = MIMO.compareSessions(moveIn, moveOut);
      preview.innerHTML = "<div class=\"text-sm mb-3\"><strong>Move-in:</strong> " + escHtml(moveIn.propertyName) +
        " | <strong>Move-out:</strong> " + escHtml(moveOut.propertyName) + "</div>" +
        compared.map(function (entry) {
          return "<div class=\"border rounded p-3 mb-2\">" +
            "<div class=\"font-medium\">" + escHtml(entry.roomName) + "</div>" +
            "<div class=\"text-xs\">Move-in items: " + entry.moveIn.total + " | Move-out items: " + entry.moveOut.total + "</div>" +
            "<div class=\"text-xs\">Move-in notes: " + escHtml(entry.moveIn.notes.join(" | ") || "-") + "</div>" +
            "<div class=\"text-xs\">Move-out notes: " + escHtml(entry.moveOut.notes.join(" | ") || "-") + "</div>" +
            "</div>";
        }).join("");
      latestReportHtml = MIMO.generateReportHtml(moveIn, moveOut);
      MIMO.saveReportSelection(moveIn.id, moveOut.id);
    }

    generateBtn.addEventListener("click", renderPreview);
    downloadBtn.addEventListener("click", function () {
      if (!latestReportHtml) {
        renderPreview();
      }
      if (!latestReportHtml) {
        alert("Generate a report first.");
        return;
      }
      MIMO.downloadBlob("mimo-report.html", latestReportHtml, "text/html");
    });
    exportJsonBtn.addEventListener("click", function () {
      MIMO.downloadBlob("mimo-sessions.json", JSON.stringify(MIMO.loadSessions(), null, 2), "application/json");
    });
  }

  function initSettingsPage() {
    var form = byId("settingsForm");
    var clearBtn = byId("clearDataBtn");
    var nameInput = byId("inspectorName");
    var companyInput = byId("companyName");
    var autoSaveCheck = byId("autoSaveCompare");
    var saved = MIMO.loadSettings();

    nameInput.value = saved.inspectorName || "";
    companyInput.value = saved.companyName || "";
    autoSaveCheck.checked = Boolean(saved.autoSaveCompare);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      MIMO.saveSettings({
        inspectorName: nameInput.value.trim(),
        companyName: companyInput.value.trim(),
        autoSaveCompare: autoSaveCheck.checked
      });
      alert("Settings saved.");
    });

    clearBtn.addEventListener("click", function () {
      if (!window.confirm("Clear all local MIMO data (sessions, active selection, report selection, settings)?")) {
        return;
      }
      MIMO.clearAllData();
      alert("Local data cleared.");
      window.location.href = "sessions.html";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    markActiveNav(page || "");
    if (page === "dashboard") { initDashboard(); }
    if (page === "sessions") { initSessionsPage(); }
    if (page === "capture") { initCapturePage(); }
    if (page === "compare") { initComparePage(); }
    if (page === "report") { initReportPage(); }
    if (page === "settings") { initSettingsPage(); }
  });
})(window, document);
