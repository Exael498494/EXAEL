/* ============================================================================
   EXAEL — Puente Google  ·  reemplazo de window.cowork fuera de Cowork
   ----------------------------------------------------------------------------
   Emula la interfaz que la app ya usa:
     window.cowork.callMcpTool(nombre, args) -> {structuredContent, content, isError}
     window.cowork.askClaude(prompt, datos)  -> string
   pero por debajo llama a las APIs REST de Google Calendar / Drive y a Gemini.
   Si la app corre DENTRO de Cowork, este archivo no hace nada.
   ========================================================================== */
(function () {
  'use strict';
  if (window.cowork && typeof window.cowork.callMcpTool === 'function') return; // ya hay puente real

  var CFG = 'exael_web_cfg_v1';
  var cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(CFG)) || {}; } catch (e) { cfg = {}; }

  var SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive'
  ].join(' ');

  var token = null, tokenExp = 0, tokenClient = null;

  /* ---------- configuración ---------- */
  function guardarCfg() { localStorage.setItem(CFG, JSON.stringify(cfg)); }
  window.exaelCfg = {
    get: function () { return Object.assign({}, cfg); },
    set: function (k, v) { cfg[k] = (v || '').trim(); guardarCfg(); },
    listo: function () { return !!cfg.clientId; }
  };

  /* ---------- autenticación ---------- */
  function esperarGIS() {
    return new Promise(function (res, rej) {
      if (window.google && google.accounts && google.accounts.oauth2) return res();
      var n = 0, t = setInterval(function () {
        if (window.google && google.accounts && google.accounts.oauth2) { clearInterval(t); res(); }
        else if (++n > 60) { clearInterval(t); rej(new Error('no se pudo cargar el script de Google')); }
      }, 200);
    });
  }

  function pedirToken(interactivo) {
    return new Promise(function (res, rej) {
      if (!cfg.clientId) return rej(new Error('falta el Client ID de Google'));
      if (token && Date.now() < tokenExp - 60000) return res(token);
      var listo = false;
      var vencido = setTimeout(function () {
        if (listo) return;
        listo = true;
        rej(new Error('Google no respondió (¿el navegador bloqueó la ventana de acceso?). Intenta de nuevo e inicia sesión con Google manualmente desde Configuración web.'));
      }, 45000);
      esperarGIS().then(function () {
        if (!tokenClient) {
          tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: cfg.clientId, scope: SCOPES, callback: function () {}
          });
        }
        tokenClient.callback = function (r) {
          if (listo) return;
          listo = true; clearTimeout(vencido);
          if (r.error) return rej(new Error(r.error_description || r.error));
          token = r.access_token;
          tokenExp = Date.now() + (parseInt(r.expires_in, 10) || 3600) * 1000;
          try { sessionStorage.setItem('exael_tok', JSON.stringify({ t: token, e: tokenExp })); } catch (e) {}
          res(token);
        };
        tokenClient.requestAccessToken({ prompt: interactivo ? 'consent' : '' });
      }).catch(function (e) { if (listo) return; listo = true; clearTimeout(vencido); rej(e); });
    });
  }

  try {                                            /* reusar token de la pestaña */
    var g = JSON.parse(sessionStorage.getItem('exael_tok') || 'null');
    if (g && g.e > Date.now() + 60000) { token = g.t; tokenExp = g.e; }
  } catch (e) {}

  window.exaelAuth = {
    conectar: function () {
      return pedirToken(true).then(function () { activarPuente(); return true; });
    },
    salir: function () {
      if (token && window.google && google.accounts && google.accounts.oauth2) {
        try { google.accounts.oauth2.revoke(token); } catch (e) {}
      }
      token = null; tokenExp = 0;
      try { sessionStorage.removeItem('exael_tok'); } catch (e) {}
    },
    conectado: function () { return !!token && Date.now() < tokenExp; }
  };

  /* ---------- llamadas HTTP ---------- */
  function api(url, opts) {
    return pedirToken(false).then(function (tk) {
      opts = opts || {};
      opts.headers = Object.assign({ Authorization: 'Bearer ' + tk }, opts.headers || {});
      return fetch(url, opts);
    }).then(function (r) {
      if (r.status === 204) return {};
      return r.text().then(function (txt) {
        var d = {}; try { d = txt ? JSON.parse(txt) : {}; } catch (e) { d = { raw: txt }; }
        if (!r.ok) {
          var m = (d.error && (d.error.message || d.error)) || ('HTTP ' + r.status);
          throw new Error(typeof m === 'string' ? m : JSON.stringify(m));
        }
        return d;
      });
    });
  }

  var CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/';
  var DRV = 'https://www.googleapis.com/drive/v3/files';
  var enc = encodeURIComponent;

  /* ---------- Calendar ---------- */
  function evSalida(e) {                            /* forma que la app ya espera */
    return {
      id: e.id, status: e.status, summary: e.summary, description: e.description,
      htmlLink: e.htmlLink, colorId: e.colorId, eventType: e.eventType,
      created: e.created, updated: e.updated, start: e.start, end: e.end
    };
  }
  function cuerpoEvento(a) {
    var b = {};
    if (a.summary != null) b.summary = a.summary;
    if (a.description != null) b.description = a.description;
    if (a.location != null) b.location = a.location;
    if (a.colorId != null) b.colorId = a.colorId;
    if (a.startTime) b.start = { dateTime: a.startTime, timeZone: a.timeZone || undefined };
    if (a.endTime) b.end = { dateTime: a.endTime, timeZone: a.timeZone || undefined };
    if (a.availability) b.transparency = a.availability === 'AVAILABILITY_FREE' ? 'transparent' : 'opaque';
    if (a.overrideReminders) {
      b.reminders = { useDefault: false, overrides: a.overrideReminders.map(function (r) {
        return { method: r.method, minutes: r.minutes };
      }) };
    }
    return b;
  }

  /* ---------- Drive ---------- */
  function archivoSalida(f) {
    return {
      id: f.id, title: f.name, mimeType: f.mimeType, fileSize: f.size,
      fileExtension: f.fileExtension, parentId: (f.parents || [])[0],
      viewUrl: f.webViewLink, createdTime: f.createdTime, modifiedTime: f.modifiedTime
    };
  }
  var CAMPOS = 'id,name,mimeType,size,fileExtension,parents,webViewLink,createdTime,modifiedTime';

  function traducirQuery(q) {                       /* `parentId = 'X'` -> `'X' in parents` */
    return String(q || '').replace(/parentId\s*=\s*'([^']+)'/g, "'$1' in parents") + " and trashed = false";
  }

  function subir(a) {
    var meta = { name: a.title, mimeType: a.contentMimeType };
    if (a.parentId) meta.parents = [a.parentId];
    if (a.contentMimeType === 'application/vnd.google-apps.folder') {
      return api(DRV + '?fields=' + enc(CAMPOS), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta)
      }).then(archivoSalida);
    }
    if (!a.disableConversionToGoogleType) {         /* CSV -> hoja de cálculo, como en Cowork */
      if (a.contentMimeType === 'text/csv') meta.mimeType = 'application/vnd.google-apps.spreadsheet';
    }
    var lim = '-------exael' + Date.now();
    var cuerpo = '--' + lim + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(meta) + '\r\n--' + lim + '\r\nContent-Type: ' + a.contentMimeType + '\r\n';
    var cierre = '\r\n--' + lim + '--';
    var blobs;
    if (a.base64Content) {
      var bin = atob(a.base64Content), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      blobs = [cuerpo + '\r\n', arr, cierre];
    } else {
      blobs = [cuerpo + '\r\n' + (a.textContent || '') + cierre];
    }
    return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=' + enc(CAMPOS), {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + lim },
      body: new Blob(blobs)
    }).then(archivoSalida);
  }

  function descargarBytes(id) {
    return pedirToken(false).then(function (tk) {
      return fetch(DRV + '/' + id + '?alt=media', { headers: { Authorization: 'Bearer ' + tk } });
    }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo descargar el archivo (HTTP ' + r.status + ')');
      return r.arrayBuffer();
    });
  }
  function bufferABase64(buf) {
    var bytes = new Uint8Array(buf), bin = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  var PDFJS_VER = '3.11.174';
  function extraerTextoPDF(buf) {
    if (!window.pdfjsLib) {
      return Promise.resolve('[No se pudo cargar el lector de PDF en esta página]');
    }
    if (!extraerTextoPDF._workerListo) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VER + '/pdf.worker.min.js';
      extraerTextoPDF._workerListo = true;
    }
    return window.pdfjsLib.getDocument({ data: buf }).promise.then(function (pdf) {
      var max = Math.min(pdf.numPages, 40);          /* tope para no colgar la pestaña con libros enormes */
      var paginas = [], cadena = Promise.resolve();
      var _loop = function (p) {
        cadena = cadena.then(function () {
          return pdf.getPage(p).then(function (pg) {
            return pg.getTextContent().then(function (tc) {
              paginas.push(tc.items.map(function (it) { return it.str || ''; }).join(' '));
            });
          });
        });
      };
      for (var p = 1; p <= max; p++) _loop(p);
      return cadena.then(function () {
        var texto = paginas.join('\n\n').trim();
        if (pdf.numPages > max) texto += '\n\n[Documento truncado: se leyeron las primeras ' + max + ' de ' + pdf.numPages + ' páginas]';
        return texto || '[Este PDF no tiene texto seleccionable — parece un escaneo. El tutor no puede leerlo como texto; conviértelo a imagen y súbelo así, o usa OCR primero.]';
      });
    });
  }
  function leerContenido(id) {
    return api(DRV + '/' + id + '?fields=id,name,mimeType', {}).then(function (f) {
      var m = f.mimeType || '';
      if (m.indexOf('application/vnd.google-apps.') === 0) {
        var exp = m.indexOf('spreadsheet') > 0 ? 'text/csv' : 'text/plain';
        return pedirToken(false).then(function (tk) {
          return fetch(DRV + '/' + id + '/export?mimeType=' + enc(exp), {
            headers: { Authorization: 'Bearer ' + tk }
          });
        }).then(function (r) { return r.text(); })
          .then(function (t) { return { fileContent: t }; });
      }
      if (m.indexOf('text/') === 0 || m.indexOf('json') > 0 || m.indexOf('csv') > 0) {
        return pedirToken(false).then(function (tk) {
          return fetch(DRV + '/' + id + '?alt=media', { headers: { Authorization: 'Bearer ' + tk } });
        }).then(function (r) { return r.text(); })
          .then(function (t) { return { fileContent: t }; });
      }
      if (m === 'application/pdf') {
        return descargarBytes(id).then(extraerTextoPDF).then(function (texto) { return { fileContent: texto }; });
      }
      if (m.indexOf('image/') === 0) {
        return descargarBytes(id).then(function (buf) {
          return { imagenBase64: bufferABase64(buf), mimeType: m };
        });
      }
      return { fileContent: '', nota: 'Ese formato no se puede leer desde el navegador. ' +
        'Los formatos legibles aquí son: PDF, imágenes, texto plano, CSV y documentos de Google.' };
    });
  }

  /* ---------- enrutador tipo MCP ---------- */
  function ruta(tool, a) {
    a = a || {};
    var accion = tool.split('__').pop();
    var cal = enc(a.calendarId || 'primary');
    switch (accion) {
      case 'list_events': {
        var p = ['singleEvents=true', 'orderBy=startTime', 'maxResults=' + (a.pageSize || 50)];
        if (a.startTime) p.push('timeMin=' + enc(a.startTime));
        if (a.endTime) p.push('timeMax=' + enc(a.endTime));
        return api(CAL_BASE + cal + '/events?' + p.join('&')).then(function (d) {
          var out = { summary: d.summary, timeZone: d.timeZone, accessRole: d.accessRole };
          var its = (d.items || []).filter(function (e) { return e.status !== 'cancelled'; });
          if (its.length) out.events = its.map(evSalida);
          return out;
        });
      }
      case 'create_event':
        return api(CAL_BASE + cal + '/events?sendUpdates=none', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpoEvento(a))
        }).then(evSalida);
      case 'update_event':
        return api(CAL_BASE + cal + '/events/' + enc(a.eventId) + '?sendUpdates=none', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpoEvento(a))
        }).then(evSalida);
      case 'delete_event':
        return api(CAL_BASE + cal + '/events/' + enc(a.eventId) + '?sendUpdates=none', { method: 'DELETE' })
          .then(function () { return { id: a.eventId, status: 'cancelled' }; });
      case 'list_calendars':
        return api('https://www.googleapis.com/calendar/v3/users/me/calendarList')
          .then(function (d) { return { calendars: (d.items || []).map(function (c) {
            return { id: c.id, summary: c.summary, timeZone: c.timeZone }; }) }; });
      case 'search_files':
        return api(DRV + '?q=' + enc(traducirQuery(a.query)) +
          '&pageSize=' + (a.pageSize || 50) + '&fields=' + enc('files(' + CAMPOS + ')') +
          '&orderBy=modifiedTime desc'
        ).then(function (d) {
          var fs = (d.files || []).map(archivoSalida);
          return fs.length ? { files: fs } : {};
        });
      case 'list_recent_files':
        return api(DRV + '?pageSize=' + (a.pageSize || 10) + '&orderBy=modifiedTime desc&fields=' +
          enc('files(' + CAMPOS + ')')).then(function (d) {
          return { files: (d.files || []).map(archivoSalida) }; });
      case 'create_file':   return subir(a);
      case 'get_file_metadata':
        return api(DRV + '/' + enc(a.fileId) + '?fields=' + enc(CAMPOS)).then(archivoSalida);
      case 'read_file_content': return leerContenido(a.fileId);
      default:
        return Promise.reject(new Error('acción no disponible en la versión web: ' + accion));
    }
  }

  /* ---------- IA (tutor y simulacros) ----------
     Soporta varios proveedores; se elige en Configuración web.
     La clave se guarda solo en este navegador. */
  var PROVEEDORES = {
    gemini: {
      nombre: 'Google AI Studio (Gemini)',
      vision: true,
      limiteTexto: 200000,
      modelos: ['gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.5-flash',
                'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash'],
      llamar: function (key, modelo, texto, imagen) {
        var parts = [{ text: texto }];
        if (imagen) parts.push({ inlineData: { mimeType: imagen.mimeType, data: imagen.base64 } });
        return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo +
          ':generateContent?key=' + enc(key), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
          })
        }).then(leerJSON).then(function (d) {
          var p = d.candidates && d.candidates[0] && d.candidates[0].content &&
                  d.candidates[0].content.parts;
          if (!p || !p.length) throw new Error('la IA no devolvió texto');
          return p.map(function (x) { return x.text || ''; }).join('');
        });
      }
    },
    openai: {
      nombre: 'OpenAI',
      vision: true,
      limiteTexto: 200000,
      modelos: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'],
      llamar: function (key, modelo, texto, imagen) {
        return chatCompletions('https://api.openai.com/v1/chat/completions',
          { Authorization: 'Bearer ' + key }, modelo, texto, imagen);
      }
    },
    groq: {
      nombre: 'Groq (gratis)',
      vision: false,
      limiteTexto: 16000,               /* la capa gratis limita tokens por minuto: hay que ir corto */
      modelos: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound', 'groq/compound-mini'],
      llamar: function (key, modelo, texto) {
        return chatCompletions('https://api.groq.com/openai/v1/chat/completions',
          { Authorization: 'Bearer ' + key }, modelo, texto);
      }
    },
    openrouter: {
      nombre: 'OpenRouter',
      vision: true,
      limiteTexto: 60000,
      modelos: ['google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct',
                'anthropic/claude-haiku-4.5'],
      llamar: function (key, modelo, texto, imagen) {
        return chatCompletions('https://openrouter.ai/api/v1/chat/completions',
          { Authorization: 'Bearer ' + key }, modelo, texto, imagen);
      }
    },
    anthropic: {
      nombre: 'Anthropic (Claude)',
      vision: true,
      limiteTexto: 200000,
      modelos: ['claude-haiku-4-5-20251001', 'claude-sonnet-5'],
      llamar: function (key, modelo, texto, imagen) {
        var content = [{ type: 'text', text: texto }];
        if (imagen) content.unshift({ type: 'image', source: { type: 'base64', media_type: imagen.mimeType, data: imagen.base64 } });
        return fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', 'x-api-key': key,
            'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: modelo, max_tokens: 4096,
            messages: [{ role: 'user', content: content }]
          })
        }).then(leerJSON).then(function (d) {
          var c = d.content && d.content[0];
          if (!c || !c.text) throw new Error('la IA no devolvió texto');
          return d.content.map(function (x) { return x.text || ''; }).join('');
        });
      }
    }
  };
  window.exaelIA = {
    proveedores: Object.keys(PROVEEDORES).map(function (k) {
      return { id: k, nombre: PROVEEDORES[k].nombre, modelos: PROVEEDORES[k].modelos };
    })
  };
  /* tope de caracteres de documento recomendado para el proveedor activo,
     para no reventar el límite de tokens de los planes gratis (ej. Groq) */
  window.exaelLimiteTexto = function () {
    var prov = PROVEEDORES[cfg.iaProv || 'gemini'];
    return (prov && prov.limiteTexto) || 20000;
  };

  function leerJSON(r) {
    return r.text().then(function (t) {
      var d = {}; try { d = t ? JSON.parse(t) : {}; } catch (e) { d = { raw: t }; }
      if (!r.ok) {
        var m = (d.error && (d.error.message || d.error)) || d.raw || ('HTTP ' + r.status);
        m = typeof m === 'string' ? m.slice(0, 300) : JSON.stringify(m).slice(0, 300);
        if (/no longer available|not found|is not supported|does not exist/i.test(m)) {
          m += '  →  Ese modelo ya no existe: elige otro en la lista.';
        } else if (/API key not valid|API_KEY_INVALID|invalid_api_key|Incorrect API key/i.test(m)) {
          m += '  →  La clave no es válida para este proveedor.';
        } else if (/too large|too long|context length|maximum context|tokens per minute|TPM/i.test(m)) {
          m += '  →  El documento o la pregunta son muy largos para este modelo. Prueba con un archivo más corto, una pregunta más puntual, o cambia a Gemini/OpenAI/Anthropic en Configuración web.';
        } else if (/quota|rate limit|RESOURCE_EXHAUSTED/i.test(m)) {
          m += '  →  Llegaste al límite: espera un rato o cambia de modelo.';
        }
        throw new Error(m);
      }
      return d;
    });
  }
  function chatCompletions(url, headers, modelo, texto, imagen) {
    var content = texto;
    if (imagen) {
      content = [{ type: 'text', text: texto },
        { type: 'image_url', image_url: { url: 'data:' + imagen.mimeType + ';base64,' + imagen.base64 } }];
    }
    return fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify({
        model: modelo, temperature: 0.7, max_tokens: 4096,
        messages: [{ role: 'user', content: content }]
      })
    }).then(leerJSON).then(function (d) {
      var c = d.choices && d.choices[0] && d.choices[0].message;
      if (!c || !c.content) throw new Error('la IA no devolvió texto');
      return c.content;
    });
  }


  /* ---------- listar los modelos que tu cuenta puede usar ----------
     Se acabó adivinar: cada proveedor expone su catálogo y lo consultamos con tu clave. */
  var LISTAS = {
    gemini: function (key) {
      return fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + enc(key) +
        '&pageSize=200').then(leerJSON).then(function (d) {
        return (d.models || [])
          .filter(function (m) {
            var g = m.supportedGenerationMethods || m.supportedActions || [];
            return g.indexOf('generateContent') >= 0;
          })
          .map(function (m) { return String(m.name || '').replace(/^models\//, ''); })
          .filter(function (n) { return n && !/embedding|aqa|tts|image|video|veo|lyria/i.test(n); });
      });
    },
    openai:     function (k) { return listaOpenAI('https://api.openai.com/v1/models', k); },
    groq:       function (k) { return listaOpenAI('https://api.groq.com/openai/v1/models', k); },
    openrouter: function (k) { return listaOpenAI('https://openrouter.ai/api/v1/models', k); },
    anthropic:  function (k) {
      return fetch('https://api.anthropic.com/v1/models?limit=100', {
        headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01',
                   'anthropic-dangerous-direct-browser-access': 'true' }
      }).then(leerJSON).then(function (d) {
        return (d.data || []).map(function (m) { return m.id; });
      });
    }
  };
  function listaOpenAI(url, key) {
    return fetch(url, { headers: { Authorization: 'Bearer ' + key } })
      .then(leerJSON).then(function (d) {
        return (d.data || []).map(function (m) { return m.id; })
          .filter(function (n) { return !/whisper|tts|embed|guard|orpheus|dall|moderation/i.test(n); });
      });
  }
  window.exaelListarModelos = function () {
    var id = cfg.iaProv || 'gemini';
    if (!cfg.iaKey) return Promise.reject(new Error('primero pega tu clave y guarda'));
    if (!LISTAS[id]) return Promise.reject(new Error('ese proveedor no publica su catálogo'));
    return LISTAS[id](cfg.iaKey).then(function (ms) {
      ms = ms.filter(Boolean).sort();
      if (!ms.length) throw new Error('tu cuenta no tiene modelos de texto disponibles');
      return ms;
    });
  };

  function askIA(prompt, datos) {
    var prov = PROVEEDORES[cfg.iaProv || 'gemini'];
    if (!prov) return Promise.reject(new Error('proveedor de IA desconocido'));
    if (!cfg.iaKey) {
      return Promise.reject(new Error(
        'Falta la clave de IA. Ve a Sincronización → Configuración web y pega tu clave.'));
    }
    var modelo = (cfg.iaModeloLibre || cfg.iaModelo || prov.modelos[0]).trim();
    var imagen = null;
    var datosTexto = (datos || []).filter(function (d) {
      if (d && d.imagenBase64) { imagen = { base64: d.imagenBase64, mimeType: d.mimeType || 'image/png' }; return false; }
      return true;
    });
    if (imagen && !prov.vision) {
      return Promise.reject(new Error('"' + prov.nombre + '" no puede leer imágenes con este modelo. ' +
        'Cambia a Gemini, OpenAI, Anthropic u OpenRouter en Configuración web para analizar imágenes.'));
    }
    var texto = prompt + (datosTexto.length ? '\n\nDatos:\n' + JSON.stringify(datosTexto, null, 1) : '');
    return prov.llamar(cfg.iaKey, modelo, texto, imagen);
  }
  window.exaelProbarIA = function () { return askIA('Responde solo: listo', []); };

  /* ---------- activación ---------- */
  function activarPuente() {
    window.cowork = {
      callMcpTool: function (tool, args) {
        return ruta(tool, args).then(function (d) {
          return { structuredContent: d, content: [{ text: JSON.stringify(d) }], isError: false };
        }).catch(function (e) {
          return { content: [{ text: e.message }], isError: true };
        });
      },
      askClaude: askIA
    };
    if (typeof window.reconectar === 'function') window.reconectar();
  }
  window.exaelActivar = activarPuente;

  if (token) activarPuente();                       /* sesión viva: entra directo */
  else if (cfg.iaKey) {                             /* solo IA, sin Google: el tutor igual funciona */
    window.cowork = window.cowork || {};
    if (!window.cowork.askClaude) window.cowork.askClaude = askIA;
  }
})();
