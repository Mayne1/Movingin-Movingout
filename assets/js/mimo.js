/* MIMO core helpers and localStorage model */
(function (window) {
  "use strict";

  var STORAGE_KEYS = {
    sessions: "mimo_sessions",
    activeSessionId: "mimo_active_session_id",
    reportSelection: "mimo_report_selection",
    settings: "mimo_settings"
  };

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function loadSessions() {
    var raw = localStorage.getItem(STORAGE_KEYS.sessions);
    var sessions = safeJsonParse(raw, []);
    return Array.isArray(sessions) ? sessions : [];
  }

  function saveSessions(sessions) {
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions || []));
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  function getActiveSessionId() {
    return localStorage.getItem(STORAGE_KEYS.activeSessionId) || "";
  }

  function setActiveSessionId(id) {
    if (!id) {
      localStorage.removeItem(STORAGE_KEYS.activeSessionId);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.activeSessionId, String(id));
  }

  function getSessionById(id) {
    return loadSessions().find(function (s) { return s.id === id; }) || null;
  }

  function getActiveSession() {
    var activeId = getActiveSessionId();
    return activeId ? getSessionById(activeId) : null;
  }

  function createSession(type, propertyName) {
    var session = {
      id: uid("session"),
      type: type === "move-out" ? "move-out" : "move-in",
      propertyName: String(propertyName || "Untitled Property").trim(),
      createdAt: new Date().toISOString(),
      rooms: []
    };
    var sessions = loadSessions();
    sessions.push(session);
    saveSessions(sessions);
    setActiveSessionId(session.id);
    return session;
  }

  function updateSession(updatedSession) {
    var sessions = loadSessions();
    var index = sessions.findIndex(function (s) { return s.id === updatedSession.id; });
    if (index === -1) {
      return null;
    }
    sessions[index] = updatedSession;
    saveSessions(sessions);
    return updatedSession;
  }

  function deleteSession(sessionId) {
    var sessions = loadSessions().filter(function (s) { return s.id !== sessionId; });
    saveSessions(sessions);
    if (getActiveSessionId() === sessionId) {
      setActiveSessionId(sessions[0] ? sessions[0].id : "");
    }
  }

  function ensureRoom(session, roomName) {
    var name = String(roomName || "").trim();
    if (!name) {
      return null;
    }
    if (!Array.isArray(session.rooms)) {
      session.rooms = [];
    }
    var existing = session.rooms.find(function (r) { return r.name.toLowerCase() === name.toLowerCase(); });
    if (existing) {
      return existing;
    }
    var room = { name: name, items: [] };
    session.rooms.push(room);
    return room;
  }

  function addRoom(sessionId, roomName) {
    var session = getSessionById(sessionId);
    if (!session) {
      return null;
    }
    var room = ensureRoom(session, roomName);
    if (!room) {
      return null;
    }
    updateSession(session);
    return room;
  }

  function addItemToRoom(sessionId, roomName, item) {
    var session = getSessionById(sessionId);
    if (!session) {
      return null;
    }
    var room = ensureRoom(session, roomName);
    if (!room) {
      return null;
    }
    room.items.push(item);
    updateSession(session);
    return item;
  }

  function dataURLToBlob(dataUrl) {
    var parts = dataUrl.split(",");
    var mimeMatch = parts[0].match(/:(.*?);/);
    var mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    var binary = atob(parts[1]);
    var len = binary.length;
    var buffer = new Uint8Array(len);
    for (var i = 0; i < len; i += 1) {
      buffer[i] = binary.charCodeAt(i);
    }
    return new Blob([buffer], { type: mime });
  }

  function compressImageToThumb(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Could not read image file.")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("Could not decode image file.")); };
        img.onload = function () {
          var width = img.width;
          var height = img.height;
          var max = maxDim || 320;
          if (width > height && width > max) {
            height = Math.round((height * max) / width);
            width = max;
          } else if (height >= width && height > max) {
            width = Math.round((width * max) / height);
            height = max;
          }
          var canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          var output = canvas.toDataURL("image/jpeg", typeof quality === "number" ? quality : 0.72);
          resolve(output);
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function createCaptureItem(file, note) {
    var ts = new Date().toISOString();
    var fileName = file && file.name ? file.name : "";
    var safeNote = String(note || "").trim();

    if (file && file.type && file.type.indexOf("image/") === 0) {
      var thumb = await compressImageToThumb(file, 320, 0.72);
      return {
        kind: "photo",
        thumb: thumb,
        note: safeNote,
        ts: ts,
        fileName: fileName
      };
    }

    return {
      kind: "video",
      note: safeNote,
      ts: ts,
      fileName: fileName
    };
  }

  function splitByType(items) {
    var photos = [];
    var videos = [];
    (items || []).forEach(function (item) {
      if (item.kind === "photo") {
        photos.push(item);
      } else if (item.kind === "video") {
        videos.push(item);
      }
    });
    return { photos: photos, videos: videos };
  }

  function getSessionRoomMap(session) {
    var map = {};
    (session && session.rooms ? session.rooms : []).forEach(function (room) {
      map[room.name] = room;
    });
    return map;
  }

  function compareSessions(moveInSession, moveOutSession) {
    var inMap = getSessionRoomMap(moveInSession);
    var outMap = getSessionRoomMap(moveOutSession);
    var names = {};
    Object.keys(inMap).forEach(function (key) { names[key] = true; });
    Object.keys(outMap).forEach(function (key) { names[key] = true; });

    return Object.keys(names).sort().map(function (name) {
      var inRoom = inMap[name] || { name: name, items: [] };
      var outRoom = outMap[name] || { name: name, items: [] };
      var inSplit = splitByType(inRoom.items);
      var outSplit = splitByType(outRoom.items);
      return {
        roomName: name,
        moveIn: {
          total: inRoom.items.length,
          photos: inSplit.photos,
          videos: inSplit.videos,
          notes: inRoom.items.map(function (i) { return i.note; }).filter(Boolean),
          timestamps: inRoom.items.map(function (i) { return i.ts; }).filter(Boolean)
        },
        moveOut: {
          total: outRoom.items.length,
          photos: outSplit.photos,
          videos: outSplit.videos,
          notes: outRoom.items.map(function (i) { return i.note; }).filter(Boolean),
          timestamps: outRoom.items.map(function (i) { return i.ts; }).filter(Boolean)
        }
      };
    });
  }

  function fmtDate(iso) {
    if (!iso) {
      return "-";
    }
    var d = new Date(iso);
    if (isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleString();
  }

  function generateReportHtml(moveInSession, moveOutSession) {
    var rows = compareSessions(moveInSession, moveOutSession).map(function (entry) {
      var inThumbs = entry.moveIn.photos.slice(0, 4).map(function (p) {
        return p.thumb ? "<img src=\"" + p.thumb + "\" alt=\"Move-in photo\" style=\"width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #ddd;margin-right:6px\"/>" : "";
      }).join("");
      var outThumbs = entry.moveOut.photos.slice(0, 4).map(function (p) {
        return p.thumb ? "<img src=\"" + p.thumb + "\" alt=\"Move-out photo\" style=\"width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #ddd;margin-right:6px\"/>" : "";
      }).join("");
      return "<tr>" +
        "<td style=\"padding:10px;border:1px solid #ddd;vertical-align:top\">" + entry.roomName + "</td>" +
        "<td style=\"padding:10px;border:1px solid #ddd;vertical-align:top\">Items: " + entry.moveIn.total + "<br/>Notes: " + (entry.moveIn.notes.join(" | ") || "-") + "<br/>Times: " + (entry.moveIn.timestamps.map(fmtDate).join(" | ") || "-") + "<div>" + inThumbs + "</div></td>" +
        "<td style=\"padding:10px;border:1px solid #ddd;vertical-align:top\">Items: " + entry.moveOut.total + "<br/>Notes: " + (entry.moveOut.notes.join(" | ") || "-") + "<br/>Times: " + (entry.moveOut.timestamps.map(fmtDate).join(" | ") || "-") + "<div>" + outThumbs + "</div></td>" +
        "</tr>";
    }).join("");

    return "<!doctype html><html><head><meta charset=\"utf-8\"/><title>MIMO Comparison Report</title></head>" +
      "<body style=\"font-family:Arial,sans-serif;padding:20px;color:#222\">" +
      "<h1>Move In / Move Out Report</h1>" +
      "<p><strong>Move-in:</strong> " + (moveInSession ? (moveInSession.propertyName + " (" + fmtDate(moveInSession.createdAt) + ")") : "-") + "</p>" +
      "<p><strong>Move-out:</strong> " + (moveOutSession ? (moveOutSession.propertyName + " (" + fmtDate(moveOutSession.createdAt) + ")") : "-") + "</p>" +
      "<table style=\"width:100%;border-collapse:collapse\"><thead><tr>" +
      "<th style=\"padding:10px;border:1px solid #ddd\">Room</th>" +
      "<th style=\"padding:10px;border:1px solid #ddd\">Move-in</th>" +
      "<th style=\"padding:10px;border:1px solid #ddd\">Move-out</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>" +
      "</body></html>";
  }

  function downloadBlob(fileName, content, mimeType) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mimeType || "text/plain" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function saveReportSelection(moveInId, moveOutId) {
    localStorage.setItem(STORAGE_KEYS.reportSelection, JSON.stringify({
      moveInId: moveInId || "",
      moveOutId: moveOutId || ""
    }));
  }

  function loadReportSelection() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.reportSelection), { moveInId: "", moveOutId: "" });
  }

  function loadSettings() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.settings), {});
  }

  function saveSettings(value) {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(value || {}));
  }

  function clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.sessions);
    localStorage.removeItem(STORAGE_KEYS.activeSessionId);
    localStorage.removeItem(STORAGE_KEYS.reportSelection);
    localStorage.removeItem(STORAGE_KEYS.settings);
  }

  window.MIMO = {
    STORAGE_KEYS: STORAGE_KEYS,
    loadSessions: loadSessions,
    saveSessions: saveSessions,
    getSessionById: getSessionById,
    getActiveSession: getActiveSession,
    getActiveSessionId: getActiveSessionId,
    setActiveSessionId: setActiveSessionId,
    createSession: createSession,
    updateSession: updateSession,
    deleteSession: deleteSession,
    addRoom: addRoom,
    addItemToRoom: addItemToRoom,
    createCaptureItem: createCaptureItem,
    compareSessions: compareSessions,
    generateReportHtml: generateReportHtml,
    downloadBlob: downloadBlob,
    loadReportSelection: loadReportSelection,
    saveReportSelection: saveReportSelection,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    clearAllData: clearAllData,
    fmtDate: fmtDate,
    dataURLToBlob: dataURLToBlob
  };
})(window);
